import assert = require('assert');
import AdmZip = require('adm-zip');
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as tl from '../_build/task';

function createArchive(root: string, entries: { [name: string]: string }): string {
    const archive = new AdmZip();
    Object.keys(entries).forEach(name => archive.addFile(name, Buffer.from(entries[name])));
    const archivePath = path.join(root, 'archive.zip');
    archive.writeZip(archivePath);
    return archivePath;
}

function createTestRoot(name: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `task-lib-${name}-`));
}

function removeTestRoot(root: string): void {
    fs.rmSync(root, { recursive: true, force: true });
}

describe('Secure ZIP extraction', function () {
    it('extracts files and directories', async function () {
        const root = createTestRoot('valid');
        try {
            const archivePath = createArchive(root, {
                'folder/file.txt': 'content'
            });
            const destination = path.join(root, 'output');

            const extractedPath = await tl.extractZipSecure(archivePath, destination);

            assert.equal(extractedPath, fs.realpathSync(destination));
            assert.equal(fs.readFileSync(path.join(destination, 'folder', 'file.txt'), 'utf8'), 'content');
        }
        finally {
            removeTestRoot(root);
        }
    });

    it('rejects archive entries outside the destination', async function () {
        const root = createTestRoot('entry');
        try {
            const archivePath = createArchive(root, {
                '../outside.txt': 'content'
            });

            await assert.rejects(
                tl.extractZipSecure(archivePath, path.join(root, 'output')),
                /Archive entry is outside the destination directory/);
        }
        finally {
            removeTestRoot(root);
        }
    });

    it('rejects a relative destination', async function () {
        const root = createTestRoot('destination');
        try {
            const archivePath = createArchive(root, { 'file.txt': 'content' });

            await assert.rejects(
                tl.extractZipSecure(archivePath, 'output'),
                /Target directory is expected to be absolute/);
        }
        finally {
            removeTestRoot(root);
        }
    });

    it('rejects an existing symlink ancestor', async function () {
        const root = createTestRoot('ancestor');
        try {
            const outside = path.join(root, 'outside');
            const destination = path.join(root, 'output');
            fs.mkdirSync(outside);
            fs.mkdirSync(destination);
            fs.symlinkSync(outside, path.join(destination, 'redirect'), process.platform === 'win32' ? 'junction' : 'dir');
            const archivePath = createArchive(root, {
                'redirect/file.txt': 'content'
            });

            await assert.rejects(
                tl.extractZipSecure(archivePath, destination),
                /Archive path resolves outside the destination directory/);
            assert.equal(fs.existsSync(path.join(outside, 'file.txt')), false);
        }
        finally {
            removeTestRoot(root);
        }
    });

    it('preserves __MACOSX entries', async function () {
        const root = createTestRoot('metadata');
        try {
            const archivePath = createArchive(root, {
                '__MACOSX/metadata.txt': 'metadata'
            });
            const destination = path.join(root, 'output');

            await tl.extractZipSecure(archivePath, destination);

            assert.equal(fs.readFileSync(path.join(destination, '__MACOSX', 'metadata.txt'), 'utf8'), 'metadata');
        }
        finally {
            removeTestRoot(root);
        }
    });
});import assert = require('node:assert');
import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import AdmZip = require('adm-zip');

import * as tl from '../_build/task';

interface TestZipEntry {
    name: string;
    content: string;
    mode?: number;
    symbolicLink?: boolean;
}

function createZip(file: string, entries: TestZipEntry[]): void {
    const archive = new AdmZip();

    for (const entry of entries) {
        const zipEntry = archive.addFile(entry.name, Buffer.from(entry.content), '', entry.mode);
        if (entry.symbolicLink) {
            zipEntry.attr = ((0xA000 | (entry.mode || 0o777)) << 16) >>> 0;
        }
    }

    archive.writeZip(file);
}

describe('extractZipSecure', () => {
    let temporaryDirectory: string;
    let archivePath: string;
    let destination: string;

    beforeEach(() => {
        temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-lib-secure-zip-'));
        archivePath = path.join(temporaryDirectory, 'archive.zip');
        destination = path.join(temporaryDirectory, 'destination');
    });

    afterEach(() => {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    it('extracts regular files and returns the canonical destination', async () => {
        createZip(archivePath, [
            { name: 'nested/file.txt', content: 'contents', mode: 0o640 },
            { name: '__MACOSX/metadata', content: 'ignored' }
        ]);

        const result = await tl.extractZipSecure(archivePath, destination);

        assert.strictEqual(result, fs.realpathSync(destination));
        assert.strictEqual(fs.readFileSync(path.join(destination, 'nested', 'file.txt'), 'utf8'), 'contents');
        assert.strictEqual(fs.readFileSync(path.join(destination, '__MACOSX', 'metadata'), 'utf8'), 'ignored');
        if (process.platform !== 'win32') {
            assert.strictEqual(fs.statSync(path.join(destination, 'nested', 'file.txt')).mode & 0o777, 0o640);
        }
    });

    it('requires an absolute destination', async () => {
        createZip(archivePath, [{ name: 'file.txt', content: 'contents' }]);

        await assert.rejects(
            tl.extractZipSecure(archivePath, 'relative-destination'),
            /Target directory is expected to be absolute/
        );
    });

    it('preserves a symbolic link whose target stays in the destination', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        createZip(archivePath, [
            { name: 'links/current', content: '../target.txt', symbolicLink: true },
            { name: 'target.txt', content: 'target contents' }
        ]);

        await tl.extractZipSecure(archivePath, destination);

        const linkPath = path.join(destination, 'links', 'current');
        assert.strictEqual(fs.lstatSync(linkPath).isSymbolicLink(), true);
        assert.strictEqual(fs.readFileSync(linkPath, 'utf8'), 'target contents');
    });

    it('rejects a symbolic link whose relative target escapes the destination', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        createZip(archivePath, [
            { name: 'links/escape', content: '../../../../etc/passwd', symbolicLink: true }
        ]);

        await assert.rejects(
            tl.extractZipSecure(archivePath, destination),
            /Archive symlink target is outside the destination directory/
        );
        assert.strictEqual(fs.existsSync(path.join(destination, 'links', 'escape')), false);
    });

    it('rejects an absolute symbolic-link target', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        createZip(archivePath, [
            { name: 'links/escape', content: '/etc/passwd', symbolicLink: true }
        ]);

        await assert.rejects(
            tl.extractZipSecure(archivePath, destination),
            /Archive symlink has an absolute target/
        );
    });

    it('rejects writes through an existing directory symlink', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        const outsideDirectory = path.join(temporaryDirectory, 'outside');
        fs.mkdirSync(destination, { recursive: true });
        fs.mkdirSync(outsideDirectory);
        fs.symlinkSync(outsideDirectory, path.join(destination, 'redirect'));
        createZip(archivePath, [{ name: 'redirect/nested/file.txt', content: 'contents' }]);

        await assert.rejects(
            tl.extractZipSecure(archivePath, destination),
            /Archive path resolves outside the destination directory/
        );
        assert.strictEqual(fs.existsSync(path.join(outsideDirectory, 'nested')), false);
    });

    it('rejects a symbolic-link target beneath an existing escaping symlink', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        const outsideDirectory = path.join(temporaryDirectory, 'outside');
        fs.mkdirSync(destination, { recursive: true });
        fs.mkdirSync(outsideDirectory);
        fs.symlinkSync(outsideDirectory, path.join(destination, 'redirect'));
        createZip(archivePath, [
            { name: 'links/escape', content: '../redirect/missing.txt', symbolicLink: true }
        ]);

        await assert.rejects(
            tl.extractZipSecure(archivePath, destination),
            /Archive path resolves outside the destination directory/
        );
        assert.strictEqual(fs.existsSync(path.join(destination, 'links', 'escape')), false);
    });

    it('rejects replacing an existing symbolic link with a regular file', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        fs.mkdirSync(destination, { recursive: true });
        fs.writeFileSync(path.join(destination, 'target.txt'), 'unchanged');
        fs.symlinkSync('target.txt', path.join(destination, 'file.txt'));
        createZip(archivePath, [{ name: 'file.txt', content: 'replacement' }]);

        await assert.rejects(
            tl.extractZipSecure(archivePath, destination),
            /Archive entry would overwrite a symbolic link/
        );
        assert.strictEqual(fs.readFileSync(path.join(destination, 'target.txt'), 'utf8'), 'unchanged');
    });

    it('rejects a malformed ZIP archive', async () => {
        fs.writeFileSync(archivePath, 'not a zip archive');

        await assert.rejects(tl.extractZipSecure(archivePath, destination));
    });
});