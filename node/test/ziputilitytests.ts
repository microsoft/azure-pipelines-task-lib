// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import fs = require('fs');
import path = require('path');
import AdmZip = require('adm-zip');
import * as tl from '../_build/task';
import * as ziputil from '../_build/ziputility';
import testutil = require('./testutil');

describe('ZIP utility tests', function () {
    let workDir: string;
    let source: string;
    let archive: string;
    let destination: string;

    // Generated with 7-Zip using ZipCrypto and password "secret"; includes an encrypted empty file.
    const encryptedArchive = Buffer.from(
        'UEsDBBQAAQAAALWSXV0AAAAADAAAAAAAAAAJAAAAZW1wdHkudHh0tukUt1GWgq7GNb/jUEsDBBQAAAAAALWSXV0AAAAAAAAAAAAAAAAH' +
        'AAAAbmVzdGVkL1BLAwQUAAEAAAC1kl1dlS1r9B0AAAARAAAADwAAAG5lc3RlZC9maWxlLnR4dD3GtgwoDqciHmHv5cdSYD/I33hwWhtW' +
        'l478h8NLUEsBAj8AFAABAAAAtZJdXQAAAAAMAAAAAAAAAAkAJAAAAAAAAAAgAAAAAAAAAGVtcHR5LnR4dAoAIAAAAAAAAQAYAGLU2j2kZ90B' +
        'AAAAAAAAAAAAAAAAAAAAAFBLAQI/ABQAAAAAALWSXV0AAAAAAAAAAAAAAAAHACQAAAAAAAAAEAAAADMAAABuZXN0ZWQvCgAgAAAAAAABABgA' +
        'Q3XZPaRn3QEAAAAAAAAAAAAAAAAAAAAAUEsBAj8AFAABAAAAtZJdXZUta/QdAAAAEQAAAA8AJAAAAAAAAAAgAAAAWAAAAG5lc3RlZC9maWxl' +
        'LnR4dAoAIAAAAAAAAQAYAHyt2j2kZ90BAAAAAAAAAAAAAAAAAAAAAFBLBQYAAAAAAwADABUBAACiAAAAAAA=',
        'base64'
    );

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

    for (const password of ['secret', Buffer.from('secret')]) {
        it(`extracts ZipCrypto archives with a ${typeof password === 'string' ? 'string' : 'Buffer'} password`, async function () {
            fs.writeFileSync(archive, encryptedArchive);
            assert(new AdmZip(archive).getEntry('empty.txt').header.encrypted);
            assert(new AdmZip(archive).getEntry('nested/file.txt').header.encrypted);
            const syncDestination = path.join(workDir, 'sync-output');
            assert.strictEqual(ziputil.extractZipSync(archive, { dir: syncDestination, password }), syncDestination);
            assert.strictEqual(await tl.extractZip(archive, { dir: destination, password }), destination);
            for (const output of [syncDestination, destination]) {
                assert.strictEqual(fs.readFileSync(path.join(output, 'nested', 'file.txt'), 'utf8'), 'encrypted content');
                assert.strictEqual(fs.readFileSync(path.join(output, 'empty.txt')).length, 0);
            }
        });
    }

    it('preserves raw Buffer password bytes and extraction options', async function () {
        // ZipCrypto password bytes 00 80 ff 01 cannot round-trip through a UTF-8 string.
        fs.writeFileSync(archive, Buffer.from(
            'UEsDBBQAAQgIALmSXV1UDhXSJQAAABcAAAAIAAAAZmlsZS50eHQ9auDmkyuTmMaP2K4fFTISOzI17BKAVBgvnqjh+BRnItTeB2yt' +
            'UEsBAhQKFAABCAgAuZJdXVQOFdIlAAAAFwAAAAgAAAAAAAAAAAAAAKSBAAAAAGZpbGUudHh0UEsFBgAAAAABAAEANgAAAEsAAAAAAA==',
            'base64'
        ));
        const password = Buffer.from([0, 128, 255, 1]);
        const originalPassword = Buffer.from(password);
        const options = { dir: destination, password, keepOriginalPermission: true };
        assert.strictEqual(ziputil.extractZipSync(archive, options), destination);
        const outputFile = path.join(destination, 'file.txt');
        assert.strictEqual(fs.readFileSync(outputFile, 'utf8'), 'binary password content');
        if (process.platform !== 'win32') {
            assert.strictEqual(fs.statSync(outputFile).mode & 0o777, 0o644);
        }
        fs.writeFileSync(outputFile, 'existing content');
        await ziputil.extractZip(archive, options);
        assert.strictEqual(fs.readFileSync(outputFile, 'utf8'), 'existing content');
        await ziputil.extractZip(archive, { ...options, overwrite: true });
        assert.strictEqual(fs.readFileSync(outputFile, 'utf8'), 'binary password content');
        assert.deepStrictEqual(password, originalPassword);
    });

    for (const password of [undefined, 'wrong', Buffer.from('wrong')]) {
        it(`rejects ZipCrypto archives with a ${password === undefined ? 'missing' : typeof password === 'string' ? 'wrong string' : 'wrong Buffer'} password`, async function () {
            fs.writeFileSync(archive, encryptedArchive);
            const expectedError = password === undefined ? /Incompatible password parameter/ : /Wrong Password/;
            assert.throws(() => ziputil.extractZipSync(archive, { dir: destination, password }), expectedError);
            await assert.rejects(ziputil.extractZip(archive, { dir: destination, password }), expectedError);
        });
    }

    it('prevents ZIP path traversal during extraction', async function () {
        const maliciousArchive = path.join(workDir, 'malicious.zip');
        const outsideFile = path.join(workDir, 'outside.txt');
        const content = Buffer.from('malicious content');
        const zip = new AdmZip();
        zip.addFile('outside.txt', content);
        // addFile normalizes paths, so set the traversal name directly on the entry.
        zip.getEntries()[0].entryName = '../outside.txt';
        zip.writeZip(maliciousArchive);
        assert.strictEqual(new AdmZip(maliciousArchive).getEntries()[0].entryName, '../outside.txt');

        assert.strictEqual(await ziputil.extractZip(maliciousArchive, destination), destination);

        assert.strictEqual(
            fs.existsSync(outsideFile),
            false,
            'ZIP extraction must not write files outside the destination'
        );
        assert.deepStrictEqual(fs.readFileSync(path.join(destination, 'outside.txt')), content);
    });

    for (const overwrite of [undefined, false, true]) {
        for (const entryName of ['file.txt', 'nested/file.txt', '../file.txt', 'nested\\..\\file.txt']) {
            it(`rejects a directory at file entry ${entryName} with overwrite=${overwrite}`, async function () {
                const zip = new AdmZip();
                zip.addFile('file.txt', Buffer.from('archive content'));
                // Preserve raw names to exercise adm-zip's extraction path normalization.
                zip.getEntries()[0].entryName = entryName;
                zip.addFile('aaa.txt', Buffer.from('must not be extracted'));
                zip.writeZip(archive);
                const conflict = path.join(destination, entryName === 'nested/file.txt' ? 'nested' : '', 'file.txt');
                fs.mkdirSync(conflict, { recursive: true });
                fs.writeFileSync(path.join(conflict, 'existing.txt'), 'existing content');
                const options = { dir: path.relative(process.cwd(), destination), overwrite };
                const isConflictError = (error: Error): boolean =>
                    error.message.includes('Path is not a file') && error.message.includes(conflict);

                assert.throws(() => ziputil.extractZipSync(archive, options), isConflictError);
                await assert.rejects(tl.extractZip(archive, options), isConflictError);
                assert(fs.statSync(conflict).isDirectory());
                assert.strictEqual(fs.readFileSync(path.join(conflict, 'existing.txt'), 'utf8'), 'existing content');
                assert(!fs.existsSync(path.join(destination, 'aaa.txt')));
            });
        }
    }

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

    it('rejects directory destinations before processing the source', async function () {
        fs.mkdirSync(archive);
        const options: ziputil.CreateZipOptions = {
            filter: () => {
                assert.fail('Source must not be processed for a directory destination');
            }
        };
        const isDestinationError = (error: Error): boolean =>
            error.message.includes('Path is not a file') && error.message.includes(archive);

        assert.throws(() => ziputil.createZipSync(source, archive, options), isDestinationError);
        await assert.rejects(tl.createZip(source, archive, options), isDestinationError);
        assert(fs.statSync(archive).isDirectory());
        assert.deepStrictEqual(fs.readdirSync(archive), []);
    });

    it('propagates skipped writes if the destination becomes a directory after validation', async function () {
        const options: ziputil.CreateZipOptions = {
            filter: () => {
                if (!fs.existsSync(archive)) {
                    fs.mkdirSync(archive);
                }
                return true;
            }
        };

        assert.throws(() => ziputil.createZipSync(source, archive, options), /failed/);
        fs.rmdirSync(archive);
        await assert.rejects(ziputil.createZip(source, archive, options), /failed/);
        assert(fs.statSync(archive).isDirectory());
        assert.deepStrictEqual(fs.readdirSync(archive), []);
    });

    it('propagates filesystem write errors unchanged', async function () {
        const originalWriteSync = fs.writeSync;
        const writeError = new Error('ZIP write failed');
        fs.writeSync = () => { throw writeError; };
        try {
            assert.throws(() => ziputil.createZipSync(source, archive), error => error === writeError);
            await assert.rejects(ziputil.createZip(source, archive), error => error === writeError);
        } finally {
            fs.writeSync = originalWriteSync;
        }
    });

    it('creates missing parent directories and overwrites existing archives', async function () {
        const nestedArchive = path.join(workDir, 'archives', 'nested', 'archive.zip');
        assert.strictEqual(ziputil.createZipSync(source, nestedArchive), nestedArchive);
        assert(fs.statSync(nestedArchive).isFile());
        fs.writeFileSync(path.join(source, 'first.txt'), 'updated');
        assert.strictEqual(await ziputil.createZip(source, nestedArchive), nestedArchive);
        ziputil.extractZipSync(nestedArchive, destination);
        assert.strictEqual(fs.readFileSync(path.join(destination, 'first.txt'), 'utf8'), 'updated');
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
