import assert = require('node:assert');
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

    it('skips __MACOSX entries and returns the canonical destination', async () => {
        createZip(archivePath, [
            { name: 'nested/file.txt', content: 'contents', mode: 0o640 },
            { name: '__MACOSX/metadata', content: 'ignored' }
        ]);

        const result = await tl.extractZipSecure(archivePath, destination);

        assert.strictEqual(result, fs.realpathSync(destination));
        assert.strictEqual(fs.readFileSync(path.join(destination, 'nested', 'file.txt'), 'utf8'), 'contents');
        assert.strictEqual(fs.existsSync(path.join(destination, '__MACOSX')), false);
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

    it('rejects a POSIX absolute symbolic-link target', async function () {
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

    it('rejects a Windows-style absolute symbolic-link target', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }

        createZip(archivePath, [
            { name: 'links/escape', content: 'C:\\Windows\\System32\\malformed', symbolicLink: true }
        ]);

        await assert.rejects(
            tl.extractZipSecure(archivePath, destination),
            /Archive symlink has an absolute target/
        );
        assert.strictEqual(fs.existsSync(path.join(destination, 'links', 'escape')), false);
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