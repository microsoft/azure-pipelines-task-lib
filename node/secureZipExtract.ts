import events = require('events');
import fs = require('fs');
import path = require('path');
import stream = require('stream');
import util = require('util');
import im = require('./internal');
import { assertSupportedNode, isWithinDirectory, S_IFDIR, S_IFLNK } from './secureZipCommon';

/** Subset of a yauzl entry used by the extractor. */
export interface ZipEntry {
    externalFileAttributes: number;
    fileName: string;
    uncompressedSize: number;
    versionMadeBy: number;
}

/** Subset of a yauzl ZipFile used by the extractor. */
export interface ZipFile {
    close(): void;
    eachEntry(): AsyncIterable<ZipEntry>;
    openReadStreamPromise(entry: ZipEntry): Promise<NodeJS.ReadableStream>;
}

interface Yauzl {
    openPromise(file: string, options: { lazyEntries: boolean }): Promise<ZipFile>;
}

/**
 * Options accepted by extractZipSecure. dir, defaultDirMode, defaultFileMode and onEntry
 * mirror the options of the extract-zip package; the remaining options are additional guards.
 */
export interface ExtractZipOptions {
    /** Absolute path of the directory to extract into. Created if missing. */
    dir: string;

    /** Mode applied to directories that carry no Unix permissions. Defaults to 0o755. */
    defaultDirMode?: number;

    /** Mode applied to files that carry no Unix permissions. Defaults to 0o644. */
    defaultFileMode?: number;

    /** Called for every entry (except __MACOSX metadata) before it is extracted. */
    onEntry?: (entry: ZipEntry, zipFile: ZipFile) => void | Promise<void>;

    /** Optional. Fails extraction when the archive holds more entries than this. */
    maxEntries?: number;

    /** Optional. Fails extraction when the declared uncompressed size exceeds this many bytes. */
    maxTotalSize?: number;
}

/** Entry description reported by SecureZipExtractor's 'extract' event. */
export interface ExtractedEntry {
    path: string;
    type: 'file' | 'directory' | 'symlink';
}

/** Options accepted by SecureZipExtractor.extract. */
export interface ZipExtractorOptions {
    /** Absolute path of the directory to extract into. */
    path: string;
}

const MAX_SYMLINK_TARGET_BYTES = 4096;
const S_IFMT = 0xF000;

// O_NOFOLLOW makes the open fail if the final path component is a symlink, closing the
// window between the lstat check and the open. It does not exist on Windows.
const NO_FOLLOW_FLAG: number = (fs.constants as { O_NOFOLLOW?: number }).O_NOFOLLOW || 0;
const WRITE_FLAGS: number = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | NO_FOLLOW_FLAG;

const pipeline = util.promisify(stream.pipeline);

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
    return (getUnixMode(entry) & S_IFMT) === S_IFDIR || entry.fileName.endsWith('/') ||
        ((entry.versionMadeBy >>> 8) === 0 && entry.externalFileAttributes === 16);
}

function isSymbolicLink(entry: ZipEntry): boolean {
    return (getUnixMode(entry) & S_IFMT) === S_IFLNK;
}

function getMode(entry: ZipEntry, directory: boolean, options: ExtractZipOptions): number {
    const entryMode = getUnixMode(entry) & 0o777;
    if (entryMode) {
        return entryMode;
    }

    const defaultMode = directory ? options.defaultDirMode : options.defaultFileMode;
    const fallbackMode = directory ? 0o755 : 0o644;
    return (defaultMode === undefined || defaultMode === null ? fallbackMode : Number(defaultMode)) & 0o777;
}

async function readSymlinkTarget(zipFile: ZipFile, entry: ZipEntry): Promise<string> {
    // A symlink target is a path, so anything beyond PATH_MAX-ish sizes is hostile.
    if (entry.uncompressedSize > MAX_SYMLINK_TARGET_BYTES) {
        throw new Error(im._loc('LIB_ArchiveSymlinkTargetTooLarge', entry.fileName));
    }

    const readStream = await zipFile.openReadStreamPromise(entry);
    const chunks: Uint8Array[] = [];
    let size = 0;

    for await (const chunk of readStream) {
        const bytes = Uint8Array.from(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        size += bytes.length;
        if (size > MAX_SYMLINK_TARGET_BYTES) {
            throw new Error(im._loc('LIB_ArchiveSymlinkTargetTooLarge', entry.fileName));
        }
        chunks.push(bytes);
    }

    return Buffer.concat(chunks).toString();
}

async function extractSymlink(zipFile: ZipFile, root: string, entry: ZipEntry, destinationPath: string): Promise<void> {
    const linkTarget = await readSymlinkTarget(zipFile, entry);
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
}

async function extractFile(zipFile: ZipFile, entry: ZipEntry, destinationPath: string, mode: number): Promise<void> {
    await ensureDestinationIsNotSymlink(destinationPath);
    const readStream = await zipFile.openReadStreamPromise(entry);

    try {
        // flags accepts the numeric form at runtime, which the typings do not describe.
        const writeStream = fs.createWriteStream(destinationPath, { flags: WRITE_FLAGS as any, mode });
        await pipeline(readStream, writeStream);
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
            throw new Error(im._loc('LIB_ArchiveEntryWouldOverwriteSymlink', destinationPath));
        }
        throw error;
    }
}

async function extractEntry(zipFile: ZipFile, root: string, entry: ZipEntry, options: ExtractZipOptions): Promise<void> {
    const destinationPath = getEntryPath(root, entry.fileName);
    const directory = isDirectory(entry);

    if (directory) {
        await ensureSafeDirectory(root, destinationPath, getMode(entry, true, options));
        return;
    }

    await ensureSafeDirectory(root, path.dirname(destinationPath));

    if (isSymbolicLink(entry)) {
        await extractSymlink(zipFile, root, entry, destinationPath);
        return;
    }

    await extractFile(zipFile, entry, destinationPath, getMode(entry, false, options));
}

function isMacOSMetadataEntry(entry: ZipEntry): boolean {
    return entry.fileName.startsWith('__MACOSX/');
}

/**
 * Securely extracts a ZIP archive. Drop-in replacement for the extract-zip package:
 *
 *     await extractZipSecure(zipPath, { dir: '/absolute/target' });
 *
 * A plain destination string is also accepted. The archive is detected by content rather than
 * by file extension, so any ZIP container (.zip, .nupkg, .vsix, .jar, ...) can be extracted.
 * Entries can neither escape the destination through '..' segments nor through symbolic links.
 *
 * @param file                  path of the ZIP archive
 * @param destinationOrOptions  absolute destination directory, or extraction options
 * @returns                     canonical (symlink-resolved) path of the destination directory
 */
export async function extractZipSecure(file: string, destinationOrOptions: string | ExtractZipOptions): Promise<string> {
    assertSupportedNode();

    const options: ExtractZipOptions = typeof destinationOrOptions === 'string'
        ? { dir: destinationOrOptions }
        : (destinationOrOptions || {} as ExtractZipOptions);

    if (!file) {
        throw new Error(im._loc('LIB_ArchiveFileRequired'));
    }
    if (!options.dir || !path.isAbsolute(options.dir)) {
        throw new Error(im._loc('LIB_ArchiveDestinationAbsolute'));
    }

    await fs.promises.mkdir(options.dir, { recursive: true });
    const root = await fs.promises.realpath(options.dir);
    const yauzl: Yauzl = require('yauzl');
    const zipFile = await yauzl.openPromise(file, { lazyEntries: true });

    let entryCount = 0;
    let totalSize = 0;

    try {
        for await (const entry of zipFile.eachEntry()) {
            if (isMacOSMetadataEntry(entry)) {
                continue;
            }

            entryCount++;
            if (options.maxEntries !== undefined && entryCount > options.maxEntries) {
                throw new Error(im._loc('LIB_ArchiveTooManyEntries', options.maxEntries));
            }

            totalSize += entry.uncompressedSize;
            if (options.maxTotalSize !== undefined && totalSize > options.maxTotalSize) {
                throw new Error(im._loc('LIB_ArchiveTooLarge', options.maxTotalSize));
            }

            if (options.onEntry) {
                await options.onEntry(entry, zipFile);
            }

            await extractEntry(zipFile, root, entry, options);
        }
    }
    finally {
        zipFile.close();
    }

    return root;
}

/**
 * Event based wrapper over extractZipSecure for code written against decompress-zip:
 *
 *     const unzipper = new SecureZipExtractor(zipPath);
 *     unzipper.on('error', reject);
 *     unzipper.on('extract', log => resolve());
 *     unzipper.extract({ path: targetDirectory });
 *
 * Emits 'extract' with the list of extracted entries on success, or 'error' on failure.
 */
export class SecureZipExtractor extends events.EventEmitter {
    private _file: string;

    constructor(file: string) {
        super();
        this._file = file;
    }

    public extract(options: ZipExtractorOptions): void {
        const log: ExtractedEntry[] = [];

        extractZipSecure(this._file, {
            dir: options && options.path,
            onEntry: (entry: ZipEntry) => {
                log.push({
                    path: entry.fileName,
                    type: isSymbolicLink(entry) ? 'symlink' : (isDirectory(entry) ? 'directory' : 'file')
                });
            }
        }).then(
            () => { this.emit('extract', log); },
            (error: Error) => { this.emit('error', error); });
    }
}

