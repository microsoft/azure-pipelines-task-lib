// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import fs = require('fs');
import path = require('path');
import * as tl from '../_build/task';
import testutil = require('./testutil');
import {
    assertRejects,
    buildZip,
    canCreateSymlinks,
    IS_WINDOWS,
    S_IFLNK,
    S_IFREG,
    TestEntry,
    zipEntry
} from './secureZipTestUtils';

describe('Secure ZIP Extraction Tests', function () {
    let workDir: string;
    let counter = 0;

    function writeZip(entries: TestEntry[], fileName?: string): string {
        const zipPath = path.join(workDir, fileName || ('archive' + (++counter) + '.zip'));
        fs.writeFileSync(zipPath, buildZip(entries));
        return zipPath;
    }

    function newDestination(): string {
        return path.join(workDir, 'output' + (++counter));
    }

    function extractWithEvents(zipPath: string, destination: string): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            const extractor = new tl.SecureZipExtractor(zipPath);
            extractor.once('error', reject);
            extractor.once('extract', resolve);
            extractor.extract({ path: destination });
        });
    }

    before(function () {
        testutil.initialize();
    });

    beforeEach(function () {
        workDir = fs.mkdtempSync(path.join(testutil.getTestTemp(), 'securezip-extract-'));
    });

    afterEach(function () {
        tl.rmRF(workDir);
    });

    it('extracts files, directories, metadata-filtered entries, callbacks, modes, and extensionless containers', async function () {
        const seen: string[] = [];
        const destination = path.join(newDestination(), 'nested');
        const folder = zipEntry('folder') + '/';
        const nestedFile = zipEntry('folder', 'file2.txt');
        const zipPath = writeZip([
            { name: 'file1.txt', data: 'one', mode: 0 },
            { name: folder, mode: 0 },
            { name: nestedFile, data: 'two', mode: S_IFREG | 0o755 },
            { name: zipEntry('__MACOSX', 'file3.txt'), data: 'metadata' }
        ], 'package');

        const result = await tl.extractZipSecure(zipPath, {
            dir: destination,
            defaultFileMode: 0o600,
            defaultDirMode: 0o700,
            onEntry: (entry) => { seen.push(entry.fileName); }
        });

        assert.strictEqual(result, fs.realpathSync(destination));
        assert.strictEqual(fs.readFileSync(path.join(destination, 'file1.txt'), 'utf8'), 'one');
        assert.strictEqual(fs.readFileSync(path.join(destination, 'folder', 'file2.txt'), 'utf8'), 'two');
        assert(!fs.existsSync(path.join(destination, '__MACOSX')));
        assert.deepStrictEqual(seen, ['file1.txt', folder, nestedFile]);
        if (!IS_WINDOWS) {
            assert.strictEqual(fs.statSync(path.join(destination, 'file1.txt')).mode & 0o777, 0o600);
            assert.strictEqual(fs.statSync(path.join(destination, 'folder')).mode & 0o777, 0o700);
            assert.strictEqual(fs.statSync(path.join(destination, 'folder', 'file2.txt')).mode & 0o777, 0o755);
        }

        const plainDestination = newDestination();
        await tl.extractZipSecure(writeZip([{ name: 'file3.txt', data: 'three' }]), plainDestination);
        assert.strictEqual(fs.readFileSync(path.join(plainDestination, 'file3.txt'), 'utf8'), 'three');
    });
    
    it('validates required paths and rejects missing, invalid, and callback-failed archives', async function () {
        const validZip = writeZip([{ name: 'file1.txt' }]);
        await assertRejects(() => tl.extractZipSecure('', { dir: newDestination() }), /file/);
        await assertRejects(() => tl.extractZipSecure(validZip, { dir: 'relative' }), /absolute/);
        await assertRejects(() => tl.extractZipSecure(validZip, <any>undefined), /absolute/);
        await assertRejects(() => tl.extractZipSecure(path.join(workDir, 'missing.zip'), { dir: newDestination() }));

        const invalidZip = path.join(workDir, 'file2.zip');
        fs.writeFileSync(invalidZip, 'not a zip');
        await assertRejects(() => tl.extractZipSecure(invalidZip, { dir: newDestination() }));
        await assertRejects(() => tl.extractZipSecure(validZip, {
            dir: newDestination(),
            onEntry: () => { throw new Error('callback failed'); }
        }), /callback failed/);
    });

    it('enforces entry and size limits and rejects paths outside the destination', async function () {
        const limitedZip = writeZip([
            { name: 'file1.txt', data: '12345' },
            { name: 'file2.txt', data: '12345' }
        ]);
        await assertRejects(() => tl.extractZipSecure(limitedZip, { dir: newDestination(), maxEntries: 1 }), /more than the allowed/);
        await assertRejects(() => tl.extractZipSecure(limitedZip, { dir: newDestination(), maxTotalSize: 9 }), /exceeds the allowed/);
        await tl.extractZipSecure(limitedZip, { dir: newDestination(), maxEntries: 2, maxTotalSize: 10 });

        for (const name of ['../file1.txt', zipEntry('folder', '..', '..', 'file1.txt'), '/folder/file1.txt', 'C:/file1.txt']) {
            const destination = newDestination();
            await assertRejects(() => tl.extractZipSecure(
                writeZip([{ name: name, data: 'content' }]),
                { dir: destination }
            ));
            assert(!fs.existsSync(path.join(workDir, 'file1.txt')));
        }
    });

    it('reports successful entries and extraction errors through SecureZipExtractor', async function () {
        const folder = zipEntry('folder') + '/';
        const file = zipEntry('folder', 'file1.txt');
        const destination = newDestination();
        const log = await extractWithEvents(writeZip([{ name: folder }, { name: file, data: 'content' }]), destination);

        assert.deepStrictEqual(log, [
            { path: folder, type: 'directory' },
            { path: file, type: 'file' }
        ]);
        assert.strictEqual(fs.readFileSync(path.join(destination, 'folder', 'file1.txt'), 'utf8'), 'content');

        const invalidZip = path.join(workDir, 'file2.zip');
        fs.writeFileSync(invalidZip, 'not a zip');
        await assertRejects(() => extractWithEvents(invalidZip, newDestination()));
        await assertRejects(() => extractWithEvents(
            writeZip([{ name: '../file3.txt', data: 'content' }]),
            newDestination()
        ));
    });

    it('extracts internal symbolic links and reports their entry type', async function () {
        if (!canCreateSymlinks()) {
            this.skip();
        }

        const destination = newDestination();
        const log = await extractWithEvents(writeZip([
            { name: 'file1.txt', data: 'content' },
            { name: 'link.txt', data: 'file1.txt', mode: S_IFLNK | 0o777 }
        ]), destination);

        assert(fs.lstatSync(path.join(destination, 'link.txt')).isSymbolicLink());
        assert.strictEqual(fs.readFileSync(path.join(destination, 'link.txt'), 'utf8'), 'content');
        assert.deepStrictEqual(log[1], { path: 'link.txt', type: 'symlink' });
    });
});
