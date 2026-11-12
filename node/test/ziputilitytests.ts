// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import childProcess = require('child_process');
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

    describe('archived symbolic links', function () {
        // Created on Linux with Info-ZIP Zip 3.0: `zip -X -0 -y -r real.zip target.txt dir nested link dirlink`, where
        // link -> target.txt, dirlink -> dir and nested/up -> ../target.txt are real symbolic links.
        const infoZipArchive =
            'UEsDBAoAAAAAAAAAIVD+Ct1ADgAAAA4AAAAKAAAAdGFyZ2V0LnR4dHRhcmdldCBjb250ZW50UEsDBAoAAAAAAAAAIVAAAAAAAAAAAAAAAAAE' +
            'AAAAZGlyL1BLAwQKAAAAAAAAACFQ+j2XNg0AAAANAAAADQAAAGRpci9pbm5lci50eHRpbm5lciBjb250ZW50UEsDBAoAAAAAAAAAIVAAAAAA' +
            'AAAAAAAAAAAHAAAAbmVzdGVkL1BLAwQKAAAAAAAAACFQD6CmQQ0AAAANAAAACQAAAG5lc3RlZC91cC4uL3RhcmdldC50eHRQSwMECgAAAAAA' +
            'AAAhUEm6pAAKAAAACgAAAAQAAABsaW5rdGFyZ2V0LnR4dFBLAwQKAAAAAAAAACFQEHqrugMAAAADAAAABwAAAGRpcmxpbmtkaXJQSwECHgMK' +
            'AAAAAAAAACFQ/grdQA4AAAAOAAAACgAAAAAAAAAAAAAApIEAAAAAdGFyZ2V0LnR4dFBLAQIeAwoAAAAAAAAAIVAAAAAAAAAAAAAAAAAEAAAA' +
            'AAAAAAAAEADtQTYAAABkaXIvUEsBAh4DCgAAAAAAAAAhUPo9lzYNAAAADQAAAA0AAAAAAAAAAAAAAKSBWAAAAGRpci9pbm5lci50eHRQSwEC' +
            'HgMKAAAAAAAAACFQAAAAAAAAAAAAAAAABwAAAAAAAAAAABAA7UGQAAAAbmVzdGVkL1BLAQIeAwoAAAAAAAAAIVAPoKZBDQAAAA0AAAAJAAAA' +
            'AAAAAAAAAAD/obUAAABuZXN0ZWQvdXBQSwECHgMKAAAAAAAAACFQSbqkAAoAAAAKAAAABAAAAAAAAAAAAAAA/6HpAAAAbGlua1BLAQIeAwoA' +
            'AAAAAAAAIVAQequ6AwAAAAMAAAAHAAAAAAAAAAAAAAD/oRUBAABkaXJsaW5rUEsFBgAAAAAHAAcAeAEAAD0BAAAAAA==';

        let canCreateSymlinks: boolean;

        before(function () {
            const probe = fs.mkdtempSync(path.join(testutil.getTestTemp(), 'symlink-probe-'));
            try {
                fs.symlinkSync('missing', path.join(probe, 'link'), 'file');
                canCreateSymlinks = true;
            } catch {
                canCreateSymlinks = false;
            } finally {
                tl.rmRF(probe);
            }
        });

        function requireSymlinks(context: Mocha.Context): void {
            if (!canCreateSymlinks) {
                context.skip();
            }
        }

        type ArchiveEntry = { name: string, content?: string, link?: string };

        function writeArchive(archiveEntries: ArchiveEntry[]): void {
            const zip = new AdmZip({ noSort: true });
            for (const archiveEntry of archiveEntries) {
                const added = zip.addFile(archiveEntry.name, Buffer.from(archiveEntry.link ?? archiveEntry.content ?? ''));
                if (archiveEntry.link !== undefined) {
                    added.header.made = 0x0314;
                    added.header.attr = 0o120777 * 0x10000;
                }
            }
            zip.writeZip(archive);
        }

        function readLink(linkPath: string): string {
            assert(fs.lstatSync(linkPath).isSymbolicLink(), `${linkPath} is not a symbolic link`);
            return fs.readlinkSync(linkPath).replace(/\\/g, '/');
        }

        it('restores links from a real Info-ZIP archive through both APIs', async function () {
            requireSymlinks(this);
            fs.writeFileSync(archive, Buffer.from(infoZipArchive, 'base64'));
            const entries = new AdmZip(archive).getEntries();
            const linkEntries = entries.filter(entry => ((entry.header.attr >>> 16) & 0xf000) === 0xa000);
            assert.deepStrictEqual(linkEntries.map(entry => entry.entryName).sort(), ['dirlink', 'link', 'nested/up']);
            assert(entries.every(entry => (entry.header.made >>> 8) === 3));

            const syncDestination = path.join(workDir, 'sync-output');
            assert.strictEqual(ziputil.extractZipSync(archive, { dir: syncDestination }), syncDestination);
            assert.strictEqual(await tl.extractZip(archive, { dir: destination }), destination);
            for (const output of [syncDestination, destination]) {
                assert.deepStrictEqual(fs.readdirSync(output).sort(), ['dir', 'dirlink', 'link', 'nested', 'target.txt']);
                assert.strictEqual(readLink(path.join(output, 'link')), 'target.txt');
                assert.strictEqual(readLink(path.join(output, 'dirlink')), 'dir');
                assert.strictEqual(readLink(path.join(output, 'nested', 'up')), '../target.txt');
                assert.strictEqual(fs.readFileSync(path.join(output, 'link'), 'utf8'), 'target content');
                assert.strictEqual(fs.readFileSync(path.join(output, 'nested', 'up'), 'utf8'), 'target content');
                assert(fs.statSync(path.join(output, 'dirlink')).isDirectory());
                assert.strictEqual(fs.readFileSync(path.join(output, 'dirlink', 'inner.txt'), 'utf8'), 'inner content');
                assert(fs.lstatSync(path.join(output, 'target.txt')).isFile());
            }
        });

        it('restores chained, dangling and non-ASCII contained links', async function () {
            requireSymlinks(this);
            writeArchive([
                { name: 'target.txt', content: 'target content' },
                { name: 'caf\u00e9', link: 'second' },
                { name: 'second', link: 'sub/../target.txt' },
                { name: 'dangling', link: 'missing.txt' }
            ]);
            assert.strictEqual(await tl.extractZip(archive, destination), destination);
            assert.strictEqual(readLink(path.join(destination, 'caf\u00e9')), 'second');
            assert.strictEqual(readLink(path.join(destination, 'second')), 'sub/../target.txt');
            assert.strictEqual(readLink(path.join(destination, 'dangling')), 'missing.txt');
            assert.strictEqual(fs.readFileSync(path.join(destination, 'caf\u00e9'), 'utf8'), 'target content');
            assert(!fs.existsSync(path.join(destination, 'missing.txt')));
        });

        const rejected: { name: string, entries: ArchiveEntry[], error: RegExp }[] = [
            { name: 'a parent-relative escape', entries: [{ name: 'link', link: '../outside.txt' }], error: /'link' -> '..\/outside.txt' is not allowed/ },
            { name: 'a nested parent-relative escape', entries: [{ name: 'a/link', link: 'b/../../../outside.txt' }], error: /'a\/link' -> .* is not allowed/ },
            { name: 'a POSIX absolute target', entries: [{ name: 'link', link: '/outside.txt' }], error: /'link' -> '\/outside.txt' is not allowed/ },
            { name: 'a drive-letter absolute target', entries: [{ name: 'link', link: 'C:/outside.txt' }], error: /is not allowed/ },
            { name: 'an empty target', entries: [{ name: 'link', link: '' }], error: /'link' -> '' is not allowed/ },
            {
                // Lexically a/b/up/../.. is the destination, but a/b/up -> .. resolves to a, so it is the destination's parent.
                name: 'an escape through another archived link',
                entries: [{ name: 'a/b/up', link: '..' }, { name: 'esc', link: 'a/b/up/../..' }],
                error: /'esc' -> 'a\/b\/up\/..\/..' is not allowed/
            },
            {
                // Case-sensitively a/UP is a plain directory, but on case-insensitive filesystems it is the a/up -> .. link.
                name: 'an escape through a case variant of another archived link',
                entries: [{ name: 'a/up', link: '..' }, { name: 'esc', link: 'a/UP/../..' }],
                error: /'esc' -> 'a\/UP\/..\/..' is not allowed/
            },
            {
                // Following d first gives x, but Windows resolves the target's ".." textually to the destination's parent.
                name: 'an escape under Windows textual parent resolution',
                entries: [{ name: 'x/y/z/', content: '' }, { name: 'd', link: 'x/y/z' }, { name: 'esc', link: 'd/../..' }],
                error: /'esc' -> 'd\/..\/..' is not allowed/
            },
            { name: 'a link loop', entries: [{ name: 'l1', link: 'l2' }, { name: 'l2', link: 'l1' }], error: /'l1' -> 'l2' is not allowed/ },
            {
                name: 'links differing only by case',
                entries: [{ name: 'link', link: 'target.txt' }, { name: 'LINK', link: 'target.txt' }],
                error: /'LINK' -> 'target.txt' is not allowed/
            },
            {
                name: 'a file beneath a link',
                entries: [{ name: 'dir/', content: '' }, { name: 'dirlink', link: 'dir' }, { name: 'dirlink/evil.txt', content: 'evil' }],
                error: /ZIP entry 'dirlink\/evil.txt' is located beneath the symbolic link entry 'dirlink'/
            },
            {
                name: 'a file beneath a case variant of a link',
                entries: [{ name: 'dir/', content: '' }, { name: 'dirlink', link: 'dir' }, { name: 'DIRLINK/evil.txt', content: 'evil' }],
                error: /ZIP entry 'DIRLINK\/evil.txt' is located beneath the symbolic link entry 'dirlink'/
            },
            {
                name: 'a directory at a link path',
                entries: [{ name: 'link', link: 'target.txt' }, { name: 'link/', content: '' }],
                error: /ZIP entry 'link\/' is located beneath the symbolic link entry 'link'/
            },
            {
                name: 'a link beneath another link',
                entries: [{ name: 'dir/', content: '' }, { name: 'dirlink', link: 'dir' }, { name: 'dirlink/inner', link: '../target.txt' }],
                error: /ZIP entry 'dirlink\/inner' is located beneath the symbolic link entry 'dirlink'/
            }
        ];

        for (const rejection of rejected) {
            for (const existingDestination of [false, true]) {
                it(`rejects ${rejection.name} before changing ${existingDestination ? 'an existing' : 'a missing'} destination through both APIs`, async function () {
                    writeArchive([{ name: 'target.txt', content: 'target content' }, ...rejection.entries]);
                    const outside = path.join(workDir, 'outside.txt');
                    fs.writeFileSync(outside, 'outside content');
                    if (existingDestination) {
                        fs.mkdirSync(destination);
                        fs.writeFileSync(path.join(destination, 'target.txt'), 'existing target');
                    }
                    const options: ziputil.ExtractZipOptions = existingDestination
                        ? { dir: destination, overwrite: true, keepOriginalPermission: false }
                        : { dir: destination };
                    assert.throws(() => ziputil.extractZipSync(archive, options), rejection.error);
                    await assert.rejects(tl.extractZip(archive, options), rejection.error);
                    if (existingDestination) {
                        assert.deepStrictEqual(fs.readdirSync(destination), ['target.txt']);
                        assert.strictEqual(fs.readFileSync(path.join(destination, 'target.txt'), 'utf8'), 'existing target');
                    } else {
                        assert(!fs.existsSync(destination));
                    }
                    assert.strictEqual(fs.readFileSync(outside, 'utf8'), 'outside content');
                });
            }
        }

        it('rejects links resolving through a pre-existing destination symlink', async function () {
            requireSymlinks(this);
            fs.mkdirSync(destination);
            fs.symlinkSync(workDir, path.join(destination, 'escape'), 'dir');
            fs.writeFileSync(path.join(workDir, 'outside.txt'), 'outside content');
            for (const entries of [
                [{ name: 'link', link: 'escape/outside.txt' }],
                [{ name: 'escape/link', link: 'outside.txt' }],
                // The target itself is harmless; only the link's parent directory is a pre-existing symlink.
                [{ name: 'escape/link', link: 'target.txt' }],
                [{ name: 'escape/sub/link', link: '../target.txt' }]
            ]) {
                writeArchive([{ name: 'target.txt', content: 'target content' }, ...entries]);
                assert.throws(() => ziputil.extractZipSync(archive, destination), /is not allowed/);
                await assert.rejects(tl.extractZip(archive, destination), /is not allowed/);
                assert.deepStrictEqual(fs.readdirSync(destination), ['escape']);
                assert.deepStrictEqual(fs.readdirSync(workDir).sort(), ['archive.zip', 'output', 'outside.txt', 'source']);
            }
        });

        it('replaces existing files and links at link paths by default and keeps them with overwrite: false', async function () {
            requireSymlinks(this);
            writeArchive([{ name: 'target.txt', content: 'target content' }, { name: 'link', link: 'target.txt' }]);
            fs.mkdirSync(destination);
            fs.writeFileSync(path.join(destination, 'link'), 'existing link path');
            await tl.extractZip(archive, { dir: destination, overwrite: false });
            assert(fs.lstatSync(path.join(destination, 'link')).isFile());
            assert.strictEqual(fs.readFileSync(path.join(destination, 'link'), 'utf8'), 'existing link path');
            await tl.extractZip(archive, destination);
            assert.strictEqual(readLink(path.join(destination, 'link')), 'target.txt');
            assert.strictEqual(fs.readFileSync(path.join(destination, 'link'), 'utf8'), 'target content');
            await tl.extractZip(archive, destination);
            assert.strictEqual(readLink(path.join(destination, 'link')), 'target.txt');
        });

        it('rejects an existing directory at a link path before extracting', async function () {
            writeArchive([{ name: 'target.txt', content: 'target content' }, { name: 'link', link: 'target.txt' }]);
            fs.mkdirSync(path.join(destination, 'link'), { recursive: true });
            assert.throws(() => ziputil.extractZipSync(archive, destination), /Path is not a file/);
            await assert.rejects(tl.extractZip(archive, destination), /Path is not a file/);
            assert.deepStrictEqual(fs.readdirSync(destination), ['link']);
            assert.deepStrictEqual(fs.readdirSync(path.join(destination, 'link')), []);
        });
    });

    describe('attribute-based directories', function () {
        const attributeFormats = [
            { name: 'Unix S_IFDIR', made: 0x0314, attr: 0o40755 * 0x10000 },
            { name: 'DOS directory', made: 0x0014, attr: 0x10 }
        ];

        for (const format of attributeFormats) {
            for (const folder of ['folder', 'caf\u00e9']) {
                for (const includeChild of [false, true]) {
                    it(`extracts ${format.name} ${folder} without a trailing slash${includeChild ? ' followed by a child file' : ' as an empty directory'}`, async function () {
                        const zip = new AdmZip({ noSort: true });
                        const directory = zip.addFile(folder, Buffer.alloc(0));
                        directory.header.made = format.made;
                        directory.header.attr = format.attr;
                        if (includeChild) {
                            zip.addFile(folder + '/file.txt', Buffer.from('child content'));
                        }
                        zip.writeZip(archive);
                        const archivedDirectory = new AdmZip(archive).getEntries()[0];
                        assert.strictEqual(archivedDirectory.entryName, folder);
                        assert.strictEqual(archivedDirectory.isDirectory, false);
                        assert.strictEqual(archivedDirectory.header.attr, format.attr);
                        assert.strictEqual(archivedDirectory.header.made, format.made);

                        const syncDestination = path.join(workDir, 'sync-output');
                        // Existing directories must not be rejected by the file-entry preflight.
                        fs.mkdirSync(path.join(destination, folder), { recursive: true });
                        assert.strictEqual(ziputil.extractZipSync(archive, { dir: syncDestination }), syncDestination);
                        assert.strictEqual(await tl.extractZip(archive, { dir: destination }), destination);
                        for (const output of [syncDestination, destination]) {
                            const outputFolder = path.join(output, folder);
                            assert(fs.statSync(outputFolder).isDirectory());
                            assert.deepStrictEqual(fs.readdirSync(output), [folder]);
                            assert.deepStrictEqual(fs.readdirSync(outputFolder), includeChild ? ['file.txt'] : []);
                            if (includeChild) {
                                assert.strictEqual(fs.readFileSync(path.join(outputFolder, 'file.txt'), 'utf8'), 'child content');
                            }
                            if (process.platform !== 'win32' && format.name === 'Unix S_IFDIR') {
                                assert.strictEqual(fs.statSync(outputFolder).mode & 0o777, 0o755);
                            }
                        }
                    });
                }
            }
        }
    });

    describe('filename decoding', function () {
        // Stored ZIP fixtures with explicit central-directory flags, raw names and Unicode Path fields.
        // Unicode Path fields are central-directory-only, as supported by extract-zip@2.0.1.
        const fixtures = [
            {
                name: 'CP437 names, including byte-distinct names that collide under UTF-8 decoding',
                archive: 'UEsDBBQAAAAAAAAAIQCpMMX+BwAAAAcAAAAOAAAAY2Fmgi9maXJzdC50eHRjb250ZW50UEsDBBQAAAAAAAAAIQCpMMX+' +
                    'BwAAAAcAAAAIAAAAY2Fmgi50eHRjb250ZW50UEsDBBQAAAAAAAAAIQCpMMX+BwAAAAcAAAAIAAAAY2Fmgy50eHRjb250ZW50' +
                    'UEsDBBQAAAAAAAAAIQCpMMX+BwAAAAcAAAAIAAAAnrXg/y50eHRjb250ZW50UEsBAhQAFAAAAAAAAAAhAKkwxf4HAAAABwAA' +
                    'AA4AAAAAAAAAAAAAAAAAAAAAAGNhZoIvZmlyc3QudHh0UEsBAhQAFAAAAAAAAAAhAKkwxf4HAAAABwAAAAgAAAAAAAAAAAAA' +
                    'AAAAMwAAAGNhZoIudHh0UEsBAhQAFAAAAAAAAAAhAKkwxf4HAAAABwAAAAgAAAAAAAAAAAAAAAAAYAAAAGNhZoMudHh0UEsB' +
                    'AhQAFAAAAAAAAAAhAKkwxf4HAAAABwAAAAgAAAAAAAAAAAAAAAAAjQAAAJ614P8udHh0UEsFBgAAAAAEAAQA3gAAALoAAAAAAA==',
                files: ['caf\u00e9/first.txt', 'caf\u00e9.txt', 'caf\u00e2.txt', '\u20a7\u2561\u03b1\u00a0.txt']
            },
            {
                name: 'UTF-8 names when the language encoding flag is set',
                archive: 'UEsDBBQAAAgAAAAAIQCpMMX+BwAAAAcAAAAQAAAAY2Fmw6kv5pel5pysLnR4dGNvbnRlbnRQSwECFAAUAAAIAAAA' +
                    'ACEAqTDF/gcAAAAHAAAAEAAAAAAAAAAAAAAAAAAAAAAAY2Fmw6kv5pel5pysLnR4dFBLBQYAAAAAAQABAD4AAAA1AAAAAAA=',
                files: ['caf\u00e9/\u65e5\u672c.txt']
            },
            {
                name: 'valid Unicode Path extra fields',
                archive: 'UEsDBBQAAAAAAAAAIQCpMMX+BwAAAAcAAAAKAAAAbGVnYWN5LnR4dGNvbnRlbnRQSwECFAAUAAAAAAAAACEAqTDF/gcA' +
                    'AAAHAAAACgAZAAAAAAAAAAAAAAAAAAAAbGVnYWN5LnR4dHVwFQABgAdzEGNhZsOpL+aXpeacrC50eHRQSwUGAAAAAAEAAQBRAAAALwAAAAAA',
                files: ['caf\u00e9/\u65e5\u672c.txt']
            },
            {
                name: 'CP437 fallback for Unicode Path fields with invalid CRC, version or length',
                archive: 'UEsDBBQAAAAAAAAAIQCpMMX+BwAAAAcAAAANAAAAYmFkLWNyYy2CLnR4dGNvbnRlbnRQSwMEFAAAAAAAAAAhAKkwxf4H' +
                    'AAAABwAAABEAAABiYWQtdmVyc2lvbi2CLnR4dGNvbnRlbnRQSwMEFAAAAAAAAAAhAKkwxf4HAAAABwAAAAsAAABlbXB0eS2C' +
                    'LnR4dGNvbnRlbnRQSwECFAAUAAAAAAAAACEAqTDF/gcAAAAHAAAADQASAAAAAAAAAAAAAAAAAAAAYmFkLWNyYy2CLnR4dHVwDgAB' +
                    'n7LIandyb25nLnR4dFBLAQIUABQAAAAAAAAAIQCpMMX+BwAAAAcAAAARABIAAAAAAAAAAAAAADIAAABiYWQtdmVyc2lvbi2CLnR4' +
                    'dHVwDgACmXYeq3dyb25nLnR4dFBLAQIUABQAAAAAAAAAIQCpMMX+BwAAAAcAAAALAAkAAAAAAAAAAAAAAGgAAABlbXB0eS2CLnR4' +
                    'dHVwBQABUWbbHFBLBQYAAAAAAwADAOAAAACYAAAAAAA=',
                files: ['bad-crc-\u00e9.txt', 'bad-version-\u00e9.txt', 'empty-\u00e9.txt']
            },
            {
                name: 'Unicode Path precedence over UTF-8 header names',
                archive: 'UEsDBBQAAAgAAAAAIQCpMMX+BwAAAAcAAAAJAAAAY2Fmw6kudHh0Y29udGVudFBLAQIUABQAAAgAAAAAIQCpMMX+' +
                    'BwAAAAcAAAAJABMAAAAAAAAAAAAAAAAAAABjYWbDqS50eHR1cA8AAZK/ED7ml6XmnKwudHh0UEsFBgAAAAABAAEASgAAAC4AAAAAAA==',
                files: ['\u65e5\u672c.txt']
            }
        ];

        async function assertDecodedFiles(contents: Buffer, expectedFiles: string[]): Promise<void> {
            fs.writeFileSync(archive, contents);
            const syncDestination = path.join(workDir, 'sync-output');
            assert.strictEqual(ziputil.extractZipSync(archive, { dir: syncDestination }), syncDestination);
            assert.strictEqual(await tl.extractZip(archive, { dir: destination }), destination);
            for (const output of [syncDestination, destination]) {
                const actualFiles: string[] = [];
                function collectFiles(directory: string, prefix: string = ''): void {
                    for (const name of fs.readdirSync(directory)) {
                        const relative = prefix + name;
                        const fullPath = path.join(directory, name);
                        if (fs.statSync(fullPath).isDirectory()) {
                            collectFiles(fullPath, relative + '/');
                        } else {
                            actualFiles.push(relative);
                            assert.strictEqual(fs.readFileSync(fullPath, 'utf8'), 'content');
                        }
                    }
                }
                collectFiles(output);
                assert.deepStrictEqual(actualFiles.sort(), expectedFiles.slice().sort());
            }
        }

        for (const fixture of fixtures) {
            it(`extracts ${fixture.name} through both APIs`, async function () {
                await assertDecodedFiles(Buffer.from(fixture.archive, 'base64'), fixture.files);
            });
        }

        it('uses CP437 even for valid UTF-8 bytes when the UTF-8 flag is unset', async function () {
            const contents = Buffer.from(fixtures[1].archive, 'base64');
            contents.writeUInt16LE(0, 6);
            const centralOffset = contents.readUInt32LE(contents.length - 6);
            contents.writeUInt16LE(0, centralOffset + 8);
            await assertDecodedFiles(contents, ['caf\u251c\u2310/\u00b5\u00f9\u00d1\u00b5\u00a3\u00bc.txt']);
        });

        it('validates conflicts against decoded Unicode paths before extraction', async function () {
            fs.writeFileSync(archive, Buffer.from(fixtures[2].archive, 'base64'));
            const conflictingPath = path.join(destination, 'caf\u00e9', '\u65e5\u672c.txt');
            fs.mkdirSync(conflictingPath, { recursive: true });
            assert.throws(() => ziputil.extractZipSync(archive, { dir: destination }), /Path is not a file/);
            await assert.rejects(tl.extractZip(archive, { dir: destination }), /Path is not a file/);
            assert.deepStrictEqual(fs.readdirSync(conflictingPath), []);
            assert.deepStrictEqual(fs.readdirSync(destination), ['caf\u00e9']);
        });

        it('continues rejecting genuinely duplicate names after Unicode decoding', async function () {
            fs.writeFileSync(archive, Buffer.from(
                'UEsDBBQAAAAAAAAAIQCpMMX+BwAAAAcAAAAIAAAAY2Fmgi50eHRjb250ZW50UEsDBBQAAAAAAAAAIQCpMMX+BwAAAAcAAAAJ' +
                'AAAAb3RoZXIudHh0Y29udGVudFBLAQIUABQAAAAAAAAAIQCpMMX+BwAAAAcAAAAIAAAAAAAAAAAAAAAAAAAAAABjYWaCLnR4' +
                'dFBLAQIUABQAAAAAAAAAIQCpMMX+BwAAAAcAAAAJABIAAAAAAAAAAAAAAC0AAABvdGhlci50eHR1cA4AAS+0II1jYWbDqS50' +
                'eHRQSwUGAAAAAAIAAgB/AAAAWwAAAAAA',
                'base64'
            ));
            assert.throws(() => ziputil.extractZipSync(archive, { dir: destination }), /Duplicate entry name/);
            await assert.rejects(tl.extractZip(archive, { dir: destination }), /Duplicate entry name/);
            assert(!fs.existsSync(destination));
        });
    });

    it('overwrites existing files by default and keeps them with overwrite: false', async function () {
        await ziputil.createZip(source, archive);
        await ziputil.extractZip(archive, destination);
        fs.writeFileSync(path.join(destination, 'first.txt'), 'existing');
        await ziputil.extractZip(archive, { dir: destination, overwrite: false });
        assert.strictEqual(fs.readFileSync(path.join(destination, 'first.txt'), 'utf8'), 'existing');
        await ziputil.extractZip(archive, { dir: destination });
        assertExtracted();
    });

    it('replaces stale file content by default when extracting synchronously', function () {
        ziputil.createZipSync(source, archive);
        fs.mkdirSync(destination);
        fs.writeFileSync(path.join(destination, 'first.txt'), 'stale content from an earlier download');
        ziputil.extractZipSync(archive, { dir: destination, overwrite: false });
        assert.strictEqual(fs.readFileSync(path.join(destination, 'first.txt'), 'utf8'), 'stale content from an earlier download');
        ziputil.extractZipSync(archive, { dir: destination });
        assertExtracted();
    });

    it('replaces stale file content by default when extracting asynchronously', async function () {
        await ziputil.createZip(source, archive);
        fs.mkdirSync(destination);
        fs.writeFileSync(path.join(destination, 'first.txt'), 'stale content from an earlier download');
        await ziputil.extractZip(archive, { dir: destination, overwrite: false });
        assert.strictEqual(fs.readFileSync(path.join(destination, 'first.txt'), 'utf8'), 'stale content from an earlier download');
        await ziputil.extractZip(archive, { dir: destination });
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
        await ziputil.extractZip(archive, { ...options, overwrite: false });
        assert.strictEqual(fs.readFileSync(outputFile, 'utf8'), 'existing content');
        await ziputil.extractZip(archive, options);
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

    it('creates a missing destination, including parent directories, for an empty archive', async function () {
        const emptySource = path.join(workDir, 'empty-source');
        fs.mkdirSync(emptySource);
        await ziputil.createZip(emptySource, archive);
        const nestedDestination = path.join(workDir, 'missing', 'parent', 'output');
        assert.strictEqual(await ziputil.extractZip(archive, nestedDestination), nestedDestination);
        assert.deepStrictEqual(fs.readdirSync(nestedDestination), []);
        const syncDestination = path.join(workDir, 'missing-sync', 'output');
        assert.strictEqual(ziputil.extractZipSync(archive, { dir: syncDestination }), syncDestination);
        assert.deepStrictEqual(fs.readdirSync(syncDestination), []);
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

    (process.platform === 'win32' ? describe.skip : describe)('Unix permissions', function () {
        let originalUmask: number;

        beforeEach(function () {
            // A restrictive umask shows whether restored modes are exact or umask-filtered.
            originalUmask = process.umask(0o077);
            const zip = new AdmZip();
            zip.addFile('bin/tool.sh', Buffer.from('#!/bin/sh\necho tool-ok\n'), '', 0o755);
            zip.addFile('data.txt', Buffer.from('data'), '', 0o644);
            zip.writeZip(archive);
        });

        afterEach(function () {
            process.umask(originalUmask);
        });

        function modeOf(file: string): number {
            return fs.statSync(path.join(destination, file)).mode & 0o777;
        }

        it('restores archived modes by default, so an extracted tool runs under a restrictive umask', function () {
            assert.strictEqual(ziputil.extractZipSync(archive, destination), destination);
            assert.strictEqual(modeOf('bin/tool.sh'), 0o755);
            assert.strictEqual(modeOf('data.txt'), 0o644);
            assert.strictEqual(childProcess.execFileSync(path.join(destination, 'bin', 'tool.sh')).toString(), 'tool-ok\n');
        });

        it('keepOriginalPermission: false uses adm-zip default modes, so the tool is not executable', function () {
            assert.strictEqual(ziputil.extractZipSync(archive, { dir: destination, keepOriginalPermission: false }), destination);
            assert.strictEqual(modeOf('bin/tool.sh'), 0o666);
            assert.throws(() => childProcess.execFileSync(path.join(destination, 'bin', 'tool.sh')), /EACCES/);
        });
    });

});
