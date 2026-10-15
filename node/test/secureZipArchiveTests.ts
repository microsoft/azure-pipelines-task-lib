// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import crypto = require('crypto');
import fs = require('fs');
import path = require('path');
import * as tl from '../_build/task';
import testutil = require('./testutil');
import {
    assertRejects,
    canCreateSymlinks,
    createSource,
    IS_WINDOWS,
    readTree,
    zipEntry
} from './secureZipTestUtils';

describe('Secure ZIP Archive Tests', function () {
    let workDir: string;
    let counter = 0;

    function newPath(name: string): string {
        return path.join(workDir, name + (++counter));
    }

    async function extract(zipFile: string): Promise<string> {
        const destination = newPath('output');
        await tl.extractZipSecure(zipFile, { dir: destination });
        return destination;
    }

    before(function () {
        testutil.initialize();
    });

    beforeEach(function () {
        workDir = fs.mkdtempSync(path.join(testutil.getTestTemp(), 'securezip-archive-'));
    });

    afterEach(function () {
        tl.rmRF(workDir);
    });

    it('creates filtered folder archives with nested output paths, ZIP paths, empty folders, and any extension', async function () {
        const source = createSource(workDir, 'source1', {
            'file1.txt': 'one',
            'file2.log': 'excluded',
            [zipEntry('folder1', 'file3.txt')]: 'three',
            [zipEntry('folder1', 'file4.log')]: 'excluded',
            [zipEntry('folder2', 'file5.txt')]: 'excluded with folder',
            [zipEntry('empty') + '/']: ''
        });
        const seen: string[] = [];
        const zipFile = path.join(workDir, 'packages', 'nested', 'archive.nupkg');

        const result = await tl.createZipSecure(source, zipFile, {
            zipPath: zipEntry('inner', 'folder'),
            filter: (relativePath: string, isDirectory: boolean) => {
                seen.push(relativePath);
                return isDirectory ? relativePath !== 'folder2' : !relativePath.endsWith('.log');
            }
        });

        assert.strictEqual(result, path.resolve(zipFile));
        assert.deepStrictEqual(readTree(await extract(zipFile)), {
            'inner/': null,
            'inner/folder/': null,
            'inner/folder/empty/': null,
            'inner/folder/file1.txt': 'one',
            'inner/folder/folder1/': null,
            'inner/folder/folder1/file3.txt': 'three'
        });
        assert(seen.indexOf(zipEntry('folder1', 'file3.txt')) >= 0);
        assert(seen.indexOf(zipEntry('folder2', 'file5.txt')) < 0);

        const emptyZip = path.join(workDir, 'archive.zip');
        await tl.createZipSecure(createSource(workDir, 'source2', {}), emptyZip);
        assert.deepStrictEqual(readTree(await extract(emptyZip)), {});
    });

    it('builds archives from buffers, local files, and folders with normalized and replaceable entries', async function () {
        const source = createSource(workDir, 'source1', { 'file1.txt': 'local' });
        const sourceFile = path.join(source, 'file1.txt');
        const folder = createSource(workDir, 'source2', { 'file2.txt': 'folder' });
        const archive = new tl.SecureZipArchive();

        archive.addFile('file3.txt', 'first');
        archive.addFile('file3.txt', 'second');
        archive.addFile('binary.bin', Buffer.from([0, 1, 2, 255]));
        archive.addFile('\\folder3\\mixed//./file4.txt', 'normalized');
        await archive.addLocalFile(sourceFile);
        await archive.addLocalFile(sourceFile, zipEntry('folder4', 'nested'), 'file5.txt');
        await archive.addLocalFolder(folder, 'folder5');

        const zipFile = path.join(workDir, 'archive.zip');
        await archive.writeZip(zipFile);
        const destination = await extract(zipFile);
        assert.strictEqual(fs.readFileSync(path.join(destination, 'file3.txt'), 'utf8'), 'second');
        assert.deepStrictEqual(fs.readFileSync(path.join(destination, 'binary.bin')), Buffer.from([0, 1, 2, 255]));
        assert.strictEqual(fs.readFileSync(path.join(destination, 'file1.txt'), 'utf8'), 'local');
        assert.strictEqual(fs.readFileSync(path.join(destination, 'folder3', 'mixed', 'file4.txt'), 'utf8'), 'normalized');
        assert.strictEqual(fs.readFileSync(path.join(destination, 'folder4', 'nested', 'file5.txt'), 'utf8'), 'local');
        assert.strictEqual(fs.readFileSync(path.join(destination, 'folder5', 'file2.txt'), 'utf8'), 'folder');

        const buffered = new tl.SecureZipArchive();
        buffered.addFile('file1.txt', 'buffered');
        const bufferedZip = path.join(workDir, 'buffered.zip');
        fs.writeFileSync(bufferedZip, await buffered.toBuffer());
        assert.deepStrictEqual(readTree(await extract(bufferedZip)), { 'file1.txt': 'buffered' });
    });

    it('validates arguments, source types, entry names, and ZIP format name limits', async function () {
        const source = createSource(workDir, 'source1', { 'file1.txt': 'content' });
        const sourceFile = path.join(source, 'file1.txt');
        const zipFile = path.join(workDir, 'archive.zip');

        await assertRejects(() => tl.createZipSecure('', zipFile), /localPath/);
        await assertRejects(() => tl.createZipSecure(source, ''), /targetFile/);
        await assertRejects(() => tl.createZipSecure(path.join(workDir, 'missing'), zipFile), /not found/);
        await assertRejects(() => tl.createZipSecure(sourceFile, zipFile), /not a directory/);
        await assertRejects(() => new tl.SecureZipArchive().addLocalFile(''), /localPath/);
        await assertRejects(() => new tl.SecureZipArchive().addLocalFile(source), /not a file/);
        await assertRejects(() => new tl.SecureZipArchive().addLocalFile(path.join(workDir, 'missing')), /not found/);
        await assertRejects(() => new tl.SecureZipArchive().addLocalFile(path.join(workDir, '\0file1.txt')));

        const archive = new tl.SecureZipArchive();
        for (const name of ['../file1.txt', zipEntry('folder', '..', '..', 'file1.txt'), 'C:/file1.txt', 'folder\\..\\file1.txt', '', '/', '.']) {
            assert.throws(() => archive.addFile(name, 'content'), /invalid/);
        }
        await assertRejects(() => archive.addLocalFolder(workDir, '../folder'), /invalid/);
        await assertRejects(() => archive.addLocalFile(__filename, '../folder'), /invalid/);

        archive.addFile('f'.repeat(0x10000) + '.txt', 'content');
        await assertRejects(() => archive.writeZip(zipFile), /invalid/);
    });

    it('preserves supported metadata, clamps timestamps, strips special mode bits, and writes standard ZIP data', async function () {
        const source = createSource(workDir, 'source1', {
            'file1.txt': 'alpha',
            'file2.txt': '',
            [zipEntry('folder1', 'file3.txt')]: 'beta',
            [zipEntry('folder2') + '/']: ''
        });
        if (!IS_WINDOWS) {
            fs.chmodSync(path.join(source, 'file1.txt'), 0o755);
        }

        const archive = new tl.SecureZipArchive();
        await archive.addLocalFolder(source);
        archive.addFile('file4.txt', 'invalid date', { mtime: new Date(NaN), mode: 0o4755 });
        archive.addFile('file5.txt', 'early', { mtime: new Date(1970, 0, 1) });
        archive.addFile('file6.txt', 'late', { mtime: new Date(2208, 0, 1) });
        archive.addFile('日本語.txt', 'unicode');

        const zipFile = path.join(workDir, 'archive.zip');
        await archive.writeZip(zipFile);
        const destination = await extract(zipFile);
        assert.strictEqual(fs.readFileSync(path.join(destination, 'file4.txt'), 'utf8'), 'invalid date');
        assert.strictEqual(fs.readFileSync(path.join(destination, 'file5.txt'), 'utf8'), 'early');
        assert.strictEqual(fs.readFileSync(path.join(destination, 'file6.txt'), 'utf8'), 'late');
        assert.strictEqual(fs.readFileSync(path.join(destination, '日本語.txt'), 'utf8'), 'unicode');
        if (!IS_WINDOWS) {
            assert.strictEqual(fs.statSync(path.join(destination, 'file1.txt')).mode & 0o777, 0o755);
            assert.strictEqual(fs.statSync(path.join(destination, 'file4.txt')).mode & 0o7777, 0o755);
        }

        const yauzl = require('yauzl');
        const zip = await yauzl.openPromise(zipFile);
        const names: string[] = [];
        try {
            for await (const entry of zip.eachEntry()) {
                names.push(entry.fileName);
            }
        }
        finally {
            zip.close();
        }
        assert(names.indexOf('file1.txt') >= 0);
        assert(names.indexOf(zipEntry('folder1', 'file3.txt')) >= 0);
    });

    it('replaces archives atomically and removes temporary output after failures', async function () {
        const zipFile = path.join(workDir, 'archive.zip');
        await tl.createZipSecure(createSource(workDir, 'source1', { 'file1.txt': 'one' }), zipFile);
        await tl.createZipSecure(createSource(workDir, 'source2', { 'file2.txt': 'two' }), zipFile);
        assert.deepStrictEqual(readTree(await extract(zipFile)), { 'file2.txt': 'two' });
        assert.deepStrictEqual(fs.readdirSync(workDir).filter((name: string) => name.endsWith('.tmp')), []);

        const source3 = createSource(workDir, 'source3', { 'file3.txt': 'three' });
        const sourceFile = path.join(source3, 'file3.txt');
        const archive = new tl.SecureZipArchive();
        await archive.addLocalFile(sourceFile);
        fs.unlinkSync(sourceFile);
        const failedZip = path.join(workDir, 'failed.zip');
        await assertRejects(() => archive.writeZip(failedZip));
        assert(!fs.existsSync(failedZip));
        assert.deepStrictEqual(fs.readdirSync(workDir).filter((name: string) => name.endsWith('.tmp')), []);

        const source4 = createSource(workDir, 'source4', { 'file4.txt': 'four' });
        const nestedZip = path.join(source4, 'archive.zip');
        fs.writeFileSync(nestedZip, 'existing');
        await assertRejects(() => tl.createZipSecure(source4, nestedZip), /cannot be part of the archive/);
        assert.strictEqual(fs.readFileSync(nestedZip, 'utf8'), 'existing');
    });

    it('preserves, skips, and validates symbolic links without following external targets', async function () {
        if (!canCreateSymlinks()) {
            this.skip();
        }

        const linkedSource = createSource(workDir, 'source1', { 'file2.txt': 'separate' });
        const source = createSource(workDir, 'source2', { 'file1.txt': 'content' });
        fs.symlinkSync('file1.txt', path.join(source, 'link.txt'));

        const zipFile = path.join(workDir, 'archive.zip');
        await tl.createZipSecure(source, zipFile);
        const destination = await extract(zipFile);
        assert(fs.lstatSync(path.join(destination, 'link.txt')).isSymbolicLink());
        assert.strictEqual(fs.readlinkSync(path.join(destination, 'link.txt')), 'file1.txt');
        assert(!fs.existsSync(path.join(destination, 'file2.txt')), linkedSource);

        const skippedZip = path.join(workDir, 'skipped.zip');
        await tl.createZipSecure(source, skippedZip, { symlinks: 'skip' });
        assert.deepStrictEqual(readTree(await extract(skippedZip)), { 'file1.txt': 'content' });

        const source3 = createSource(workDir, 'source3', { 'file3.txt': 'content' });
        fs.symlinkSync(path.join('..', path.basename(linkedSource)), path.join(source3, 'link'));
        await assertRejects(() => tl.createZipSecure(source3, path.join(workDir, 'external.zip')), /outside the source/);

        const source4 = createSource(workDir, 'source4', { 'file4.txt': 'content' });
        fs.symlinkSync(path.join(source4, 'file4.txt'), path.join(source4, 'link'));
        await assertRejects(() => tl.createZipSecure(source4, path.join(workDir, 'absolute.zip')), /absolute target/);
    });
});
