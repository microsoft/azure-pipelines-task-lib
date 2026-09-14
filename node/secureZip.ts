import fs = require('fs');
import path = require('path');
import stream = require('stream');
import util = require('util');
import im = require('./internal');


interface ZipEntry {
    externalFileAttributes: number; // metadata about the file, including Unix permissions and file type
    fileName: string; // the name of the file within the ZIP archive
    versionMadeBy: number; // the version of the software that made the ZIP entry
}

interface ZipFile {
    close(): void;
    eachEntry(): AsyncIterable<ZipEntry>; // iterates over each entry in the ZIP archive asynchronously
    openReadStreamPromise(entry: ZipEntry): Promise<NodeJS.ReadableStream>; // opens a readable stream for the specified ZIP entry
}

interface Yauzl {
    openPromise(file: string, options: { lazyEntries: boolean }): Promise<ZipFile>;
}

const pipeline = util.promisify(stream.pipeline);

function isWithinDirectory(root: string, candidate: string): boolean {
    const relativePath = path.relative(root, candidate);
    return relativePath === '' ||
        (!path.isAbsolute(relativePath) && relativePath.split(path.sep).indexOf('..') < 0);
}

function getEntryPath(root: string, entryName: string): string {
    const entryPath = path.resolve(root, ...entryName.split('/'));
    if (!isWithinDirectory(root, entryPath)) {
        throw new Error(im._loc('LIB_ArchiveEntryOutsideDestination', entryName));
    }

    return entryPath;
}

async function ensureExistingAncestorIsSafe(root: string, candidate: string): Promise<void> {
    let existingPath = candidate;

    while (true) {
        try {
            const realPath = await fs.promises.realpath(existingPath);
            if (!isWithinDirectory(root, realPath)) {
                throw new Error(im._loc('LIB_ArchivePathOutsideDestination', candidate));
            }
            return;
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }

            const parentPath = path.dirname(existingPath);
            if (parentPath === existingPath) {
                throw error;
            }
            existingPath = parentPath;
        }
    }
}

async function ensureSafeDirectory(root: string, directoryPath: string, mode?: number): Promise<void> {
    await ensureExistingAncestorIsSafe(root, directoryPath);
    await fs.promises.mkdir(directoryPath, { recursive: true, mode });

    const realDirectoryPath = await fs.promises.realpath(directoryPath);
    if (!isWithinDirectory(root, realDirectoryPath)) {
        throw new Error(im._loc('LIB_ArchiveDirectoryOutsideDestination', directoryPath));
    }
}

async function ensureDestinationIsNotSymlink(entryPath: string): Promise<void> {
    try {
        const stats = await fs.promises.lstat(entryPath);
        if (stats.isSymbolicLink()) {
            throw new Error(im._loc('LIB_ArchiveEntryWouldOverwriteSymlink', entryPath));
        }
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }
}

function getUnixMode(entry: ZipEntry): number {
    return (entry.externalFileAttributes >>> 16) & 0xFFFF;
}

function isDirectory(entry: ZipEntry): boolean {
    const fileType = getUnixMode(entry) & 0xF000;
    return fileType === 0x4000 || entry.fileName.endsWith('/') ||
        ((entry.versionMadeBy >>> 8) === 0 && entry.externalFileAttributes === 16);
}

function isSymbolicLink(entry: ZipEntry): boolean {
    return (getUnixMode(entry) & 0xF000) === 0xA000;
}

function getMode(entry: ZipEntry, directory: boolean): number {
    return (getUnixMode(entry) & 0o777) || (directory ? 0o755 : 0o644);
}

async function readEntry(zipFile: ZipFile, entry: ZipEntry): Promise<Buffer> {
    const readStream = await zipFile.openReadStreamPromise(entry);
    const chunks: Uint8Array[] = [];

    for await (const chunk of readStream) {
        chunks.push(Uint8Array.from(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    }

    return Buffer.concat(chunks);
}

async function extractEntry(zipFile: ZipFile, root: string, entry: ZipEntry): Promise<void> {
    const destinationPath = getEntryPath(root, entry.fileName);
    const directory = isDirectory(entry);

    if (directory) {
        await ensureSafeDirectory(root, destinationPath, getMode(entry, true));
        return;
    }

    await ensureSafeDirectory(root, path.dirname(destinationPath));

    if (isSymbolicLink(entry)) {
        const linkTarget = (await readEntry(zipFile, entry)).toString();
        if (path.posix.isAbsolute(linkTarget) || path.win32.isAbsolute(linkTarget)) {
            throw new Error(im._loc('LIB_ArchiveSymlinkAbsoluteTarget', entry.fileName));
        }

        const normalizedTarget = linkTarget.replace(/\\/g, '/');
        const resolvedTarget = path.resolve(path.dirname(destinationPath), ...normalizedTarget.split('/'));
        if (!isWithinDirectory(root, resolvedTarget)) {
            throw new Error(im._loc('LIB_ArchiveSymlinkTargetOutsideDestination', entry.fileName));
        }
        await ensureExistingAncestorIsSafe(root, resolvedTarget);

        await ensureDestinationIsNotSymlink(destinationPath);
        await fs.promises.symlink(linkTarget, destinationPath);
        return;
    }

    await ensureDestinationIsNotSymlink(destinationPath);
    const readStream = await zipFile.openReadStreamPromise(entry);
    await pipeline(readStream, fs.createWriteStream(destinationPath, { mode: getMode(entry, false) }));
}

/**
 * Extracts a ZIP archive while preventing entries and symbolic links from escaping the destination.
 *
 * @param file Path to the ZIP archive.
 * @param destination Absolute path to the extraction directory.
 * @returns The canonical path to the extraction directory.
 */
export async function extractZipSecure(file: string, destination: string): Promise<string> {
    if (!file) {
        throw new Error(im._loc('LIB_ArchiveFileRequired'));
    }
    if (!destination || !path.isAbsolute(destination)) {
        throw new Error(im._loc('LIB_ArchiveDestinationAbsolute'));
    }

    await fs.promises.mkdir(destination, { recursive: true });
    const root = await fs.promises.realpath(destination);
    const yauzl: Yauzl = require('yauzl');
    const zipFile = await yauzl.openPromise(file, { lazyEntries: true });

    try {
        for await (const entry of zipFile.eachEntry()) {
            await extractEntry(zipFile, root, entry);
        }
    }
    finally {
        zipFile.close();
    }

    return root;
}
