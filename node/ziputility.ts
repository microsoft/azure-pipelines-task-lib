import type AdmZip = require('adm-zip');
import fs = require('fs');
import path = require('path');
import { _loc } from './internal';

const cp437HighBytes =
    '\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5' +
    '\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192' +
    '\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb' +
    '\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510' +
    '\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567' +
    '\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580' +
    '\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229' +
    '\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0';

function filenameCrc32(data: Buffer): number {
    let crc = 0xffffffff;
    for (let index = 0; index < data.length; index++) {
        crc ^= data[index];
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function decodeZipEntryName(entry: AdmZip.IZipEntry): string {
    const rawName = entry.rawEntryName;
    const extra = entry.extra;
    let unicodeName: string | undefined;
    for (let offset = 0; offset + 4 <= extra.length;) {
        const id = extra.readUInt16LE(offset);
        const size = extra.readUInt16LE(offset + 2);
        const start = offset + 4;
        const end = start + size;
        if (end > extra.length) {
            throw new Error(_loc('LIB_OperationFailed', 'extract ZIP', 'Extra field length exceeds extra field buffer size'));
        }
        // Info-ZIP Unicode Path overrides the header name only when its version and CRC match.
        if (unicodeName === undefined && id === 0x7075 && size >= 6 && extra[start] === 1 &&
            extra.readUInt32LE(start + 1) === filenameCrc32(rawName)) {
            unicodeName = extra.toString('utf8', start + 5, end);
        }
        offset = end;
    }
    if (unicodeName !== undefined) {
        return unicodeName;
    }
    if (entry.header.flags & 0x800) {
        return rawName.toString('utf8');
    }
    return Array.from(rawName, byte => byte < 128 ? String.fromCharCode(byte) : cp437HighBytes[byte - 128]).join('');
}

export interface ExtractZipOptions {
    dir: string;
    /**
     * Whether existing files are overwritten. Defaults to true, matching extract-zip@2.0.1.
     * Set to false to keep existing files. File/directory conflicts always throw, regardless of this option.
     */
    overwrite?: boolean;
    /**
     * Whether archived Unix permissions are restored. Defaults to true, matching extract-zip@2.0.1.
     * Set to false to use adm-zip's default modes. Restored modes bypass umask, and files without
     * permission metadata fall back to 0o666 in adm-zip@0.6.1. This is not exact mode/umask parity.
     */
    keepOriginalPermission?: boolean;
    /** Password for encrypted entries. Strings use UTF-8; Buffers supply raw password bytes. */
    password?: string | Buffer;
}

export interface CreateZipOptions {
    /** Folder inside the archive. Defaults to the archive root. */
    zipPath?: string;
    filter?: AdmZip.EntryFilter;
}

/**
 * Extracts a ZIP synchronously and returns the destination.
 * Rejects existing non-file paths for file entries before extracting any entries.
 * Existing files are overwritten unless overwrite is false.
 * Decodes UTF-8 and CP437 names, honoring valid Info-ZIP Unicode Path extra fields.
 */
export function extractZipSync(file: string, destination: string | ExtractZipOptions): string {
    if (!file) {
        throw new Error(_loc('LIB_ParameterIsRequired', 'file'));
    }
    const options: ExtractZipOptions = typeof destination === 'string' ? { dir: destination } : destination;
    if (!options || !options.dir) {
        throw new Error(_loc('LIB_ParameterIsRequired', 'dir'));
    }
    const Zip: typeof AdmZip = require('adm-zip');
    // Keep byte-distinct names distinct during adm-zip's duplicate check, before entry metadata is available.
    const decodedNames = new WeakMap<Uint8Array, string>();
    const zip = new Zip(file, {
        decoder: {
            encode: name => Buffer.from(name, 'latin1'),
            decode: name => decodedNames.get(name) ?? Buffer.from(name).toString('latin1')
        }
    });
    const entries = zip.getEntries();
    const names = new Set<string>();
    for (const entry of entries) {
        const name = decodeZipEntryName(entry);
        if (names.has(name)) {
            throw new Error(_loc('LIB_OperationFailed', 'extract ZIP', `Duplicate entry name "${name}"`));
        }
        names.add(name);
        decodedNames.set(entry.rawEntryName, name);
    }
    const password = options.password;
    for (const entry of entries) {
        if (entry.isDirectory) {
            continue;
        }
        // Match adm-zip's rooted normalization, including backslashes and traversal segments.
        const entryPath = path.posix.normalize('/' + entry.entryName.replace(/\\/g, '/'));
        const outputPath = path.join(path.resolve(options.dir), entryPath);
        if (fs.existsSync(outputPath) && !fs.statSync(outputPath).isFile()) {
            throw new Error(_loc('LIB_PathIsNotAFile', outputPath));
        }
        if (Buffer.isBuffer(password) && entry.header.encrypted) {
            entry.getData = entry.getData.bind(entry, password);
        }
    }
    // adm-zip creates directories only per entry, so an empty archive would otherwise leave dir missing.
    fs.mkdirSync(options.dir, { recursive: true });
    zip.extractAllTo(options.dir, options.overwrite ?? true, options.keepOriginalPermission ?? true, options.password);
    return options.dir;
}

/** Promise wrapper around extractZipSync. Rejects on failure. ZIP processing still runs synchronously. */
export async function extractZip(file: string, destination: string | ExtractZipOptions): Promise<string> {
    return extractZipSync(file, destination);
}

/**
 * Archives a folder's contents synchronously and returns the ZIP path.
 * Throws if the destination exists but is not a file, or if writing fails.
 */
export function createZipSync(sourceDirectory: string, destinationZip: string, options?: CreateZipOptions): string {
    if (!sourceDirectory) {
        throw new Error(_loc('LIB_ParameterIsRequired', 'sourceDirectory'));
    }
    if (!destinationZip) {
        throw new Error(_loc('LIB_ParameterIsRequired', 'destinationZip'));
    }
    if (fs.existsSync(destinationZip) && !fs.statSync(destinationZip).isFile()) {
        throw new Error(_loc('LIB_PathIsNotAFile', destinationZip));
    }
    const Zip: typeof AdmZip = require('adm-zip');
    const zip = new Zip();
    zip.addLocalFolder(sourceDirectory, options && options.zipPath, options && options.filter);
    zip.writeZip(destinationZip, (error) => {
        if (error) {
            throw error;
        }
    });
   return destinationZip;
}

/** Promise wrapper around createZipSync. Rejects on failure. ZIP processing still runs synchronously. */
export async function createZip(sourceDirectory: string, destinationZip: string, options?: CreateZipOptions): Promise<string> {
    return createZipSync(sourceDirectory, destinationZip, options);
}
