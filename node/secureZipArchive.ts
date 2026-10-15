import crypto = require('crypto');
import fs = require('fs');
import path = require('path');
import stream = require('stream');
import util = require('util');
import zlib = require('zlib');
import im = require('./internal');
import { assertSupportedNode, isWithinDirectory, S_IFDIR, S_IFLNK } from './secureZipCommon';

const S_IFREG = 0x8000;

const pipeline = util.promisify(stream.pipeline);

interface PendingEntry {
    kind: 'buffer' | 'directory' | 'file' | 'symlink';
    mode: number;
    mtime: Date;
    data?: Buffer;
    sourcePath?: string;
}

interface ZipRecord {
    compressedSize: number;
    crc: number;
    date: number;
    flags: number;
    method: number;
    mode: number;
    name: Buffer;
    offset: number;
    time: number;
    uncompressedSize: number;
}

type ChunkWriter = (chunk: Buffer) => Promise<void>;

/** Decides whether a local file or folder is added. Receives the path relative to the source folder, using '/' separators. */
export type ZipEntryFilter = (relativePath: string, isDirectory: boolean) => boolean;

/** How symbolic links found while adding a local folder are handled. */
export type ZipSymlinkMode = 'preserve' | 'skip';

export interface ZipArchiveOptions {
    /**
     * 'preserve' (default) stores symbolic links as links, 'skip' leaves them out. Links are never
     * followed, so content outside the source folder cannot be added by accident. A link with an
     * absolute target, or a target outside the source folder, fails the operation.
     */
    symlinks?: ZipSymlinkMode;
}

export interface AddFileOptions {
    /** Unix permission bits. Defaults to 0o644. */
    mode?: number;

    /** Last modification time. Defaults to now. */
    mtime?: Date;
}

export interface CreateZipOptions extends ZipArchiveOptions {
    /** Folder inside the archive that receives the contents of the source folder. Defaults to the archive root. */
    zipPath?: string;

    /** Excludes files and folders. Excluding a folder excludes everything below it. */
    filter?: ZipEntryFilter;
}

const ZIP_UTF8_FLAG = 0x0800;
const ZIP_DESCRIPTOR_FLAG = 0x0008;
const ZIP_METHOD_STORE = 0;
const ZIP_METHOD_DEFLATE = 8;
const ZIP_VERSION_UNIX = 3 << 8;

// Entries and offsets are written in the classic 32 bit format. Only the entry count can exceed
// its classic limit, which the ZIP64 end of central directory records cover.
const ZIP_MAX_SIZE = 0xFFFFFFFE;
const ZIP_MAX_CLASSIC_ENTRIES = 0xFFFE;
const ZIP_WRITE_BLOCK_SIZE = 64 * 1024;

let crcTable: Uint32Array | undefined;

function updateCrc32(crc: number, data: Buffer): number {
    const native = (zlib as unknown as { crc32?: (data: Buffer, value?: number) => number }).crc32;
    if (native) {
        return native(data, crc);
    }

    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let index = 0; index < 256; index++) {
            let value = index;
            for (let bit = 0; bit < 8; bit++) {
                value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
            }
            crcTable[index] = value >>> 0;
        }
    }

    let result = (crc ^ 0xFFFFFFFF) >>> 0;
    for (let index = 0; index < data.length; index++) {
        result = crcTable[(result ^ data[index]) & 0xFF] ^ (result >>> 8);
    }

    return (result ^ 0xFFFFFFFF) >>> 0;
}

function toDosDateTime(value: Date): { time: number, date: number } {
    const year = value.getFullYear();

    // The DOS format only covers 1980 through 2107.
    if (isNaN(value.getTime()) || year < 1980) {
        return { time: 0, date: 0x21 };
    }
    if (year > 2107) {
        return { time: 0xBF7D, date: 0xFF9F };
    }

    return {
        time: (value.getHours() << 11) | (value.getMinutes() << 5) | (value.getSeconds() >> 1),
        date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate()
    };
}

function writeUInt64LE(buffer: Buffer, value: number, offset: number): void {
    buffer.writeUInt32LE(value % 0x100000000, offset);
    buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 4);
}

function createZipRecord(name: string, entry: PendingEntry, offset: number): ZipRecord {
    const nameBuffer = Buffer.from(name, 'utf8');
    if (nameBuffer.length > 0xFFFF) {
        throw new Error(im._loc('LIB_ArchiveEntryNameInvalid', name));
    }

    const dos = toDosDateTime(entry.mtime);
    return {
        compressedSize: 0,
        crc: 0,
        date: dos.date,
        flags: ZIP_UTF8_FLAG,
        method: ZIP_METHOD_STORE,
        mode: entry.mode,
        name: nameBuffer,
        offset: offset,
        time: dos.time,
        uncompressedSize: 0
    };
}

function buildLocalHeader(record: ZipRecord): Buffer {
    const header = Buffer.alloc(30 + record.name.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(record.flags, 6);
    header.writeUInt16LE(record.method, 8);
    header.writeUInt16LE(record.time, 10);
    header.writeUInt16LE(record.date, 12);
    header.writeUInt32LE(record.crc, 14);
    header.writeUInt32LE(record.compressedSize, 18);
    header.writeUInt32LE(record.uncompressedSize, 22);
    header.writeUInt16LE(record.name.length, 26);
    header.writeUInt16LE(0, 28);
    record.name.copy(header, 30);
    return header;
}

function buildDataDescriptor(record: ZipRecord): Buffer {
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(record.crc, 4);
    descriptor.writeUInt32LE(record.compressedSize, 8);
    descriptor.writeUInt32LE(record.uncompressedSize, 12);
    return descriptor;
}

function buildCentralHeader(record: ZipRecord): Buffer {
    const header = Buffer.alloc(46 + record.name.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(ZIP_VERSION_UNIX | 20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(record.flags, 8);
    header.writeUInt16LE(record.method, 10);
    header.writeUInt16LE(record.time, 12);
    header.writeUInt16LE(record.date, 14);
    header.writeUInt32LE(record.crc, 16);
    header.writeUInt32LE(record.compressedSize, 20);
    header.writeUInt32LE(record.uncompressedSize, 24);
    header.writeUInt16LE(record.name.length, 28);
    header.writeUInt32LE((record.mode << 16) >>> 0, 38);
    header.writeUInt32LE(record.offset, 42);
    record.name.copy(header, 46);
    return header;
}

function buildEndRecords(entryCount: number, centralSize: number, centralOffset: number): Buffer {
    const zip64 = entryCount > ZIP_MAX_CLASSIC_ENTRIES;
    const parts: Buffer[] = [];

    if (zip64) {
        const record = Buffer.alloc(56);
        record.writeUInt32LE(0x06064b50, 0);
        writeUInt64LE(record, 44, 4);
        record.writeUInt16LE(ZIP_VERSION_UNIX | 45, 12);
        record.writeUInt16LE(45, 14);
        writeUInt64LE(record, entryCount, 24);
        writeUInt64LE(record, entryCount, 32);
        writeUInt64LE(record, centralSize, 40);
        writeUInt64LE(record, centralOffset, 48);

        const locator = Buffer.alloc(20);
        locator.writeUInt32LE(0x07064b50, 0);
        writeUInt64LE(locator, centralOffset + centralSize, 8);
        locator.writeUInt32LE(1, 16);

        parts.push(record, locator);
    }

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(zip64 ? 0xFFFF : entryCount, 8);
    end.writeUInt16LE(zip64 ? 0xFFFF : entryCount, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralOffset, 16);
    parts.push(end);

    return Buffer.concat(parts);
}

// Entries whose content is held in memory know their checksum and sizes before the header is written.
function prepareInMemoryEntry(record: ZipRecord, entry: PendingEntry): Buffer {
    const data = entry.data || Buffer.alloc(0);
    const compress = entry.kind === 'buffer' && data.length > 0;
    const payload = compress ? zlib.deflateRawSync(data) : data;

    record.crc = updateCrc32(0, data);
    record.method = compress ? ZIP_METHOD_DEFLATE : ZIP_METHOD_STORE;
    record.compressedSize = payload.length;
    record.uncompressedSize = data.length;
    return payload;
}

// Files are streamed, so their checksum and sizes are only known afterwards and go into a data descriptor.
async function writeFileContent(sourcePath: string, record: ZipRecord, write: ChunkWriter): Promise<void> {
    let crc = 0;
    let compressedSize = 0;
    let uncompressedSize = 0;

    const measure = new stream.Transform({
        transform(chunk: Buffer, encoding: string, callback: stream.TransformCallback): void {
            crc = updateCrc32(crc, chunk);
            uncompressedSize += chunk.length;
            callback(uncompressedSize > ZIP_MAX_SIZE ? new Error(im._loc('LIB_ArchiveZip64Unsupported')) : null, chunk);
        }
    });
    const sink = new stream.Writable({
        write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void): void {
            compressedSize += chunk.length;
            write(chunk).then(() => callback(), callback);
        }
    });

    await pipeline(fs.createReadStream(sourcePath), measure, zlib.createDeflateRaw(), sink);

    record.crc = crc;
    record.compressedSize = compressedSize;
    record.uncompressedSize = uncompressedSize;
}

async function writeZipArchive(entries: Map<string, PendingEntry>, write: ChunkWriter): Promise<void> {
    let offset = 0;
    let pending: Buffer[] = [];
    let pendingSize = 0;

    // Headers are small, so they are combined into larger writes.
    const flush = async (): Promise<void> => {
        if (pendingSize > 0) {
            const block = Buffer.concat(pending);
            pending = [];
            pendingSize = 0;
            await write(block);
        }
    };
    const emit: ChunkWriter = async (chunk: Buffer): Promise<void> => {
        offset += chunk.length;
        if (offset > ZIP_MAX_SIZE) {
            throw new Error(im._loc('LIB_ArchiveZip64Unsupported'));
        }

        pending.push(chunk);
        pendingSize += chunk.length;
        if (pendingSize >= ZIP_WRITE_BLOCK_SIZE) {
            await flush();
        }
    };

    const records: ZipRecord[] = [];
    for (const name of Array.from(entries.keys()).sort()) {
        const entry = entries.get(name)!;
        const record = createZipRecord(name, entry, offset);

        if (entry.kind === 'file') {
            record.flags |= ZIP_DESCRIPTOR_FLAG;
            record.method = ZIP_METHOD_DEFLATE;
            await emit(buildLocalHeader(record));
            await writeFileContent(entry.sourcePath!, record, emit);
            await emit(buildDataDescriptor(record));
        }
        else {
            const payload = prepareInMemoryEntry(record, entry);
            await emit(buildLocalHeader(record));
            if (payload.length > 0) {
                await emit(payload);
            }
        }

        records.push(record);
    }

    const centralOffset = offset;
    for (const record of records) {
        await emit(buildCentralHeader(record));
    }

    await emit(buildEndRecords(records.length, offset - centralOffset, centralOffset));
    await flush();
}

function writeChunk(output: fs.WriteStream, chunk: Buffer): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
        output.write(chunk, (error?: Error | null) => error ? reject(error) : resolve());
    });
}

function compareByName(first: fs.Dirent, second: fs.Dirent): number {
    return first.name < second.name ? -1 : (first.name > second.name ? 1 : 0);
}

/**
 * Normalizes a path inside an archive to '/' separators without leading, trailing or empty segments.
 * Returns an empty string for the archive root.
 */
function normalizeEntryName(name: string): string {
    const segments = name.replace(/\\/g, '/').split('/').filter((segment: string) => segment !== '' && segment !== '.');

    if (segments.some((segment: string) => segment === '..') || /^[A-Za-z]:$/.test(segments[0] || '')) {
        throw new Error(im._loc('LIB_ArchiveEntryNameInvalid', name));
    }

    return segments.join('/');
}

function toEntryName(zipPath: string, relativePath: string, directory: boolean): string {
    const name = normalizeEntryName(zipPath ? zipPath + '/' + relativePath : relativePath);
    if (!name) {
        throw new Error(im._loc('LIB_ArchiveEntryNameInvalid', relativePath));
    }

    return directory ? name + '/' : name;
}

async function statSource(sourcePath: string): Promise<fs.Stats> {
    try {
        return await fs.promises.stat(sourcePath);
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(im._loc('LIB_ArchiveSourceNotFound', sourcePath));
        }
        throw error;
    }
}

/**
 * Builds a ZIP archive from files, buffers and local folders. Replacement for the archive creating
 * part of adm-zip (addFile, addLocalFile, addLocalFolder, writeZip, toBuffer). Entries are collected
 * first and written together, so adding an entry name twice keeps the last one. All operations that
 * touch the file system are asynchronous. Archives and entries larger than 4 GiB are not supported.
 *
 *     const archive = new SecureZipArchive();
 *     await archive.addLocalFolder(contentsDirectory);
 *     await archive.writeZip(zipFile);
 */
export class SecureZipArchive {
    private _entries = new Map<string, PendingEntry>();
    private _symlinks: ZipSymlinkMode;

    constructor(options?: ZipArchiveOptions) {
        assertSupportedNode();
        this._symlinks = (options && options.symlinks) || 'preserve';
    }

    /**
     * Adds a file whose content is held in memory.
     *
     * @param entryName  path of the file inside the archive
     * @param data       file content
     * @param options    optional permissions and modification time
     */
    public addFile(entryName: string, data: Buffer | string, options?: AddFileOptions): void {
        const name = toEntryName('', entryName || '', false);
        this._entries.set(name, {
            kind: 'buffer',
            data: Buffer.isBuffer(data) ? data : Buffer.from(data || ''),
            mode: S_IFREG | this._getPermissions(options && options.mode, 0o644),
            mtime: (options && options.mtime) || new Date()
        });
    }

    /**
     * Adds a file from disk.
     *
     * @param localPath  path of the file
     * @param zipPath    folder inside the archive. Defaults to the archive root.
     * @param zipName    name inside the archive. Defaults to the name of the file.
     */
    public async addLocalFile(localPath: string, zipPath?: string, zipName?: string): Promise<void> {
        if (!localPath) {
            throw new Error(im._loc('LIB_ParameterIsRequired', 'localPath'));
        }

        const sourcePath = path.resolve(localPath);
        const stats = await statSource(sourcePath);
        if (!stats.isFile()) {
            throw new Error(im._loc('LIB_ArchiveSourceNotFile', sourcePath));
        }

        const name = toEntryName(normalizeEntryName(zipPath || ''), zipName || path.basename(sourcePath), false);
        this._addSourceFile(name, sourcePath, stats);
    }

    /**
     * Adds the contents of a folder recursively, including empty folders.
     *
     * @param localPath  path of the folder
     * @param zipPath    folder inside the archive. Defaults to the archive root.
     * @param filter     optional filter deciding which files and folders are added
     */
    public async addLocalFolder(localPath: string, zipPath?: string, filter?: ZipEntryFilter): Promise<void> {
        if (!localPath) {
            throw new Error(im._loc('LIB_ParameterIsRequired', 'localPath'));
        }

        const root = path.resolve(localPath);
        const stats = await statSource(root);
        if (!stats.isDirectory()) {
            throw new Error(im._loc('LIB_ArchiveSourceNotDirectory', root));
        }

        await this._addFolder(root, root, '', normalizeEntryName(zipPath || ''), filter);
    }

    /**
     * Writes the archive to a file. The archive is written to a temporary file next to the target
     * and then moved into place, so a failure never leaves a partial archive behind.
     *
     * @param targetFile  path of the zip file to create or replace
     * @returns           absolute path of the zip file
     */
    public async writeZip(targetFile: string): Promise<string> {
        if (!targetFile) {
            throw new Error(im._loc('LIB_ParameterIsRequired', 'targetFile'));
        }

        const target = path.resolve(targetFile);
        this._assertTargetIsNotAnEntry(target);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });

        const temporaryFile = target + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
        const output = fs.createWriteStream(temporaryFile, { flags: 'wx' });
        const closed = new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
            output.once('close', resolve);
            output.once('error', reject);
        });
        // The promise is awaited later; this keeps an early stream error from surfacing as unhandled.
        closed.catch(() => undefined);

        try {
            await writeZipArchive(this._entries, (chunk: Buffer) => writeChunk(output, chunk));
            output.end();
            await closed;
            await fs.promises.rename(temporaryFile, target);
        }
        catch (error) {
            output.destroy();
            await closed.catch(() => undefined);
            await fs.promises.unlink(temporaryFile).catch(() => undefined);
            throw error;
        }

        return target;
    }

    /** Returns the archive as a buffer. Prefer writeZip for large archives. */
    public async toBuffer(): Promise<Buffer> {
        const chunks: Buffer[] = [];
        await writeZipArchive(this._entries, (chunk: Buffer) => {
            chunks.push(chunk);
            return Promise.resolve();
        });

        return Buffer.concat(chunks);
    }

    private _getPermissions(mode: number | undefined, fallback: number): number {
        return mode === undefined || mode === null ? fallback : (mode & 0o777);
    }

    private _addSourceFile(name: string, sourcePath: string, stats: fs.Stats): void {
        this._entries.set(name, {
            kind: 'file',
            sourcePath: sourcePath,
            mode: S_IFREG | (stats.mode & 0o777),
            mtime: stats.mtime
        });
    }

    private async _addFolder(root: string, directory: string, relativePath: string, zipPath: string, filter?: ZipEntryFilter): Promise<void> {
        const children = await fs.promises.readdir(directory, { withFileTypes: true });
        children.sort(compareByName);

        for (const child of children) {
            const sourcePath = path.join(directory, child.name);
            const childPath = relativePath ? relativePath + '/' + child.name : child.name;
            const isSymlink = child.isSymbolicLink();
            const isFolder = child.isDirectory();

            // Sockets, pipes and devices cannot be stored.
            if (!isSymlink && !isFolder && !child.isFile()) {
                continue;
            }
            if (isSymlink && this._symlinks === 'skip') {
                continue;
            }
            if (filter && !filter(childPath, isFolder)) {
                continue;
            }

            const stats = await fs.promises.lstat(sourcePath);
            const name = toEntryName(zipPath, childPath, isFolder);

            if (isSymlink) {
                this._addSymlink(root, name, sourcePath, await fs.promises.readlink(sourcePath), stats);
            }
            else if (isFolder) {
                this._entries.set(name, { kind: 'directory', mode: S_IFDIR | (stats.mode & 0o777), mtime: stats.mtime });
                await this._addFolder(root, sourcePath, childPath, zipPath, filter);
            }
            else {
                this._addSourceFile(name, sourcePath, stats);
            }
        }
    }

    private _addSymlink(root: string, name: string, sourcePath: string, target: string, stats: fs.Stats): void {
        if (path.posix.isAbsolute(target) || path.win32.isAbsolute(target)) {
            throw new Error(im._loc('LIB_ArchiveSymlinkAbsoluteTarget', sourcePath));
        }

        const normalizedTarget = target.replace(/\\/g, '/');
        const resolvedTarget = path.resolve(path.dirname(sourcePath), ...normalizedTarget.split('/'));
        if (!isWithinDirectory(root, resolvedTarget)) {
            throw new Error(im._loc('LIB_ArchiveSymlinkTargetOutsideSource', sourcePath));
        }

        this._entries.set(name, {
            kind: 'symlink',
            data: Buffer.from(normalizedTarget),
            mode: S_IFLNK | 0o777,
            mtime: stats.mtime
        });
    }

    // An existing zip inside a folder that is being zipped would otherwise be added to itself.
    private _assertTargetIsNotAnEntry(target: string): void {
        this._entries.forEach((entry: PendingEntry) => {
            if (entry.sourcePath && path.relative(entry.sourcePath, target) === '') {
                throw new Error(im._loc('LIB_ArchiveDestinationInsideSource', target));
            }
        });
    }
}

/**
 * Creates a ZIP archive from the contents of a folder. Replacement for the common adm-zip sequence
 * addLocalFolder followed by writeZip:
 *
 *     await createZipSecure(contentsDirectory, zipFile);
 *
 * @param sourceDirectory  folder whose contents are archived
 * @param destinationZip   path of the zip file to create or replace. It must not be inside the archived contents.
 * @param options          optional archive folder, filter and symbolic link handling
 * @returns                absolute path of the zip file
 */
export async function createZipSecure(sourceDirectory: string, destinationZip: string, options?: CreateZipOptions): Promise<string> {
    const archive = new SecureZipArchive(options);
    await archive.addLocalFolder(sourceDirectory, options && options.zipPath, options && options.filter);
    return archive.writeZip(destinationZip);
}
