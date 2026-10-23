// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import fs = require('fs');
import path = require('path');
import * as tl from '../_build/task';
import * as ziputil from '../_build/ziputility';
import testutil = require('./testutil');

describe('ZIP utility tests', function () {
    let workDir: string;
    let source: string;
    let archive: string;
    let destination: string;

    before(function () {
        testutil.initialize();
    });

    beforeEach(function () {
        workDir = fs.mkdtempSync(path.join(testutil.getTestTemp(), 'ziputility-'));
        source = path.join(workDir, 'source');
        archive = path.join(workDir, 'archive.zip');
        destination = path.join(workDir, 'output');
        fs.mkdirSync(source);
        fs.mkdirSync(path.join(source, 'nested'));
        fs.mkdirSync(path.join(source, 'empty'));
        fs.writeFileSync(path.join(source, 'first.txt'), 'first');
        fs.writeFileSync(path.join(source, 'nested', 'binary.bin'), Buffer.from([0, 1, 128, 255]));
        fs.writeFileSync(path.join(source, 'empty.txt'), '');
    });

    afterEach(function () {
        tl.rmRF(workDir);
    });

    function assertExtracted(): void {
        assert.deepStrictEqual(fs.readdirSync(destination).sort(), ['empty', 'empty.txt', 'first.txt', 'nested']);
        assert.deepStrictEqual(fs.readdirSync(path.join(destination, 'nested')), ['binary.bin']);
        assert.strictEqual(fs.readFileSync(path.join(destination, 'first.txt'), 'utf8'), 'first');
        assert.deepStrictEqual(fs.readFileSync(path.join(destination, 'nested', 'binary.bin')), Buffer.from([0, 1, 128, 255]));
        assert.strictEqual(fs.readFileSync(path.join(destination, 'empty.txt'), 'utf8'), '');
        assert.deepStrictEqual(fs.readdirSync(path.join(destination, 'empty')), []);
    }

    it('round-trips files and empty directories through the exported Promise helpers', async function () {
        assert.strictEqual(await tl.createZip(source, archive), archive);
        assert.strictEqual(await tl.extractZip(archive, { dir: destination }), destination);
        assertExtracted();
    });

    it('supports synchronous callers and destination strings', function () {
        assert.strictEqual(ziputil.createZipSync(source, archive), archive);
        assert.strictEqual(ziputil.extractZipSync(archive, destination), destination);
        assertExtracted();
    });

    it('does not overwrite by default and supports explicit overwrite', async function () {
        await ziputil.createZip(source, archive);
        await ziputil.extractZip(archive, destination);
        fs.writeFileSync(path.join(destination, 'first.txt'), 'existing');
        await ziputil.extractZip(archive, { dir: destination });
        assert.strictEqual(fs.readFileSync(path.join(destination, 'first.txt'), 'utf8'), 'existing');
        await ziputil.extractZip(archive, { dir: destination, overwrite: true });
        assertExtracted();
    });

    it('passes archive path prefixes and filters to adm-zip', async function () {
        await ziputil.createZip(source, archive, {
            zipPath: path.join('package', 'contents'),
            filter: (entryPath: string) => !entryPath.endsWith('.bin')
        });
        await ziputil.extractZip(archive, destination);
        assert.strictEqual(fs.readFileSync(path.join(destination, 'package', 'contents', 'first.txt'), 'utf8'), 'first');
        assert(!fs.existsSync(path.join(destination, 'package', 'contents', 'nested', 'binary.bin')));
    });

    it('round-trips an empty source directory', async function () {
        const emptySource = path.join(workDir, 'empty-source');
        fs.mkdirSync(emptySource);
        await ziputil.createZip(emptySource, archive);
        // With no entries, adm-zip does not create the extraction destination.
        fs.mkdirSync(destination);
        assert.strictEqual(await ziputil.extractZip(archive, destination), destination);
        assert.deepStrictEqual(fs.readdirSync(destination), []);
    });

    it('rejects failed operations and throws for synchronous callers', async function () {
        const missing = path.join(workDir, 'missing');
        await assert.rejects(ziputil.extractZip('', destination), /file/);
        await assert.rejects(ziputil.extractZip(archive, { dir: '' }), /dir/);
        await assert.rejects(ziputil.createZip('', archive), /sourceDirectory/);
        await assert.rejects(ziputil.createZip(source, ''), /destinationZip/);
        await assert.rejects(ziputil.extractZip(missing, destination));
        await assert.rejects(ziputil.createZip(missing, archive));
        fs.writeFileSync(archive, 'not a zip');
        await assert.rejects(ziputil.extractZip(archive, destination));
        assert.throws(() => ziputil.extractZipSync(archive, destination));
        assert.throws(() => ziputil.createZipSync(missing, archive));
        fs.writeFileSync(archive, 'existing');
        await assert.rejects(ziputil.createZip(source, path.join(archive, 'invalid.zip')));
    });

});
