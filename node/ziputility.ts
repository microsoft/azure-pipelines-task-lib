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

const maxSymlinkDepth = 40;

interface ArchivedSymlink {
    name: string;
    /** Destination-relative path segments. */
    parts: string[];
    /** Link target, with `/` separators. */
    target: string;
    /** Destination-relative segments the target resolves to. */
    resolved?: string[];
}

/** Archived links keyed by destination-relative path under one filename comparison rule. */
interface LinkLookup {
    key: (parts: string[]) => string;
    links: Map<string, ArchivedSymlink>;
}

/** Destination-relative path segments, matching adm-zip's rooted entry normalization. */
function entryPathParts(name: string): string[] {
    return path.posix.normalize('/' + name.replace(/\\/g, '/')).split('/').filter(part => part.length > 0);
}

function exactKey(parts: string[]): string {
    return parts.join('/');
}

/** Approximates case- and normalization-insensitive filesystems such as NTFS and APFS. */
function foldedKey(parts: string[]): string {
    return parts.join('/').normalize('NFC').toLowerCase();
}

function isSymlinkOnDisk(filePath: string): boolean {
    try {
        return fs.lstatSync(filePath).isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Resolves target relative to start, following archived links and resolving `..` after them (POSIX semantics).
 * Returns undefined if resolution leaves the destination, loops, or passes through a pre-existing destination symlink.
 * Every component of start is also checked, so an unresolved or symlinked starting directory is rejected.
 */
function resolveInDestination(start: string[], target: string, lookup: LinkLookup, root: string, depth: number = 0): string[] | undefined {
    if (depth > maxSymlinkDepth) {
        return undefined;
    }
    for (let length = 1; length <= start.length; length++) {
        const prefix = start.slice(0, length);
        if (lookup.links.has(lookup.key(prefix)) || isSymlinkOnDisk(path.join(root, ...prefix))) {
            return undefined;
        }
    }
    const parts = start.slice();
    for (const part of target.split('/')) {
        if (!part || part === '.') {
            continue;
        }
        if (part === '..') {
            if (parts.length === 0) {
                return undefined;
            }
            parts.pop();
            continue;
        }
        parts.push(part);
        const link = lookup.links.get(lookup.key(parts));
        if (link) {
            const resolved = resolveInDestination(parts.slice(0, -1), link.target, lookup, root, depth + 1);
            if (!resolved) {
                return undefined;
            }
            parts.splice(0, parts.length, ...resolved);
        } else if (isSymlinkOnDisk(path.join(root, ...parts))) {
            return undefined;
        }
    }
    return parts;
}

/** Resolves `.` and `..` textually, as Windows does for relative link targets. Returns undefined if the result leaves the destination. */
function normalizeLexically(start: string[], target: string): string[] | undefined {
    const parts = start.slice();
    for (const part of target.split('/')) {
        if (!part || part === '.') {
            continue;
        }
        if (part === '..') {
            if (parts.length === 0) {
                return undefined;
            }
            parts.pop();
        } else {
            parts.push(part);
        }
    }
    return parts;
}

/**
 * Validates archived links before anything is written: targets must be relative and non-empty, and must stay
 * inside the destination under POSIX resolution (case-sensitive and case-insensitive) and Windows textual
 * resolution. No other entry may be at or beneath a link, and no existing directory may occupy a link path.
 */
function validateSymlinks(symlinks: ArchivedSymlink[], otherEntries: { name: string, parts: string[] }[], root: string): void {
    const exact: LinkLookup = { key: exactKey, links: new Map() };
    const folded: LinkLookup = { key: foldedKey, links: new Map() };
    for (const link of symlinks) {
        const key = foldedKey(link.parts);
        // Links differing only by case or Unicode normalization would collide on Windows and macOS.
        if (!key || folded.links.has(key)) {
            throw new Error(_loc('LIB_ZipSymlinkNotAllowed', link.name, link.target));
        }
        exact.links.set(exactKey(link.parts), link);
        folded.links.set(key, link);
    }
    // Compared case-insensitively so the result does not depend on the destination filesystem.
    const checked = otherEntries.map(entry => ({ ...entry, isLink: false }))
        .concat(symlinks.map(link => ({ name: link.name, parts: link.parts, isLink: true })));
    for (const entry of checked) {
        const lastPrefix = entry.isLink ? entry.parts.length - 1 : entry.parts.length;
        for (let length = 1; length <= lastPrefix; length++) {
            const owner = folded.links.get(foldedKey(entry.parts.slice(0, length)));
            if (owner) {
                throw new Error(_loc('LIB_ZipEntryBeneathSymlink', entry.name, owner.name));
            }
        }
    }
    for (const link of symlinks) {
        const target = link.target;
        const parentParts = link.parts.slice(0, -1);
        const absolute = target.startsWith('/') || /^[a-zA-Z]:/.test(target);
        let contained = !absolute && target.length > 0 && !target.includes('\0');
        // Resolving the link's own parent first also rejects pre-existing destination symlinks above it.
        for (const lookup of [exact, folded]) {
            const parent = contained ? resolveInDestination([], parentParts.join('/'), lookup, root) : undefined;
            contained = !!parent && !!resolveInDestination(parent, target, lookup, root);
        }
        const lexical = contained ? normalizeLexically(parentParts, target) : undefined;
        link.resolved = lexical && resolveInDestination([], lexical.join('/'), folded, root);
        if (!link.resolved) {
            throw new Error(_loc('LIB_ZipSymlinkNotAllowed', link.name, target));
        }
        const linkPath = path.join(root, ...link.parts);
        let existing: fs.Stats | undefined;
        try {
            existing = fs.lstatSync(linkPath);
        } catch {
            existing = undefined;
        }
        if (existing && existing.isDirectory()) {
            throw new Error(_loc('LIB_PathIsNotAFile', linkPath));
        }
    }
}

/** Creates validated links after all other entries are extracted, so nothing is written through them. */
function createSymlinks(symlinks: ArchivedSymlink[], root: string, overwrite: boolean): void {
    for (const link of symlinks) {
        const linkPath = path.join(root, ...link.parts);
        fs.mkdirSync(path.dirname(linkPath), { recursive: true });
        if (isSymlinkOnDisk(linkPath) || fs.existsSync(linkPath)) {
            if (!overwrite) {
                continue;
            }
            fs.unlinkSync(linkPath);
        }
        // Windows needs the link type up front; links to missing targets are created as file links.
        let type: 'dir' | 'file' = 'file';
        try {
            if (fs.statSync(path.join(root, ...link.resolved!)).isDirectory()) {
                type = 'dir';
            }
        } catch {
            type = 'file';
        }
        fs.symlinkSync(link.target, linkPath, type);
    }
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
 * Recognizes directory entries by trailing separators or Unix/DOS directory attributes.
 * Restores Unix symbolic link entries as symbolic links after all other entries are extracted. Before any
 * destination path is created or modified, rejects archives whose links are empty, absolute, circular, resolve
 * outside the destination (including through other links or pre-existing destination symlinks), or have other
 * entries at or beneath them.
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
    const password = options.password;
    const root = path.resolve(options.dir);
    const symlinks: ArchivedSymlink[] = [];
    const otherEntries: { name: string, parts: string[] }[] = [];
    for (const entry of entries) {
        let name = decodeZipEntryName(entry);
        const unixFileType = (entry.header.attr >>> 16) & 0xf000;
        if (unixFileType === 0xa000) {
            if (names.has(name)) {
                throw new Error(_loc('LIB_OperationFailed', 'extract ZIP', `Duplicate entry name "${name}"`));
            }
            names.add(name);
            const data = entry.getData(password);
            if (!data) {
                throw new Error(_loc('LIB_OperationFailed', 'extract ZIP', `Unable to read symbolic link entry "${name}"`));
            }
            let target = data.toString('utf8');
            // Backslashes are separators on Windows only; on POSIX they are ordinary filename characters.
            if (process.platform === 'win32') {
                target = target.replace(/\\/g, '/');
            }
            symlinks.push({ name, parts: entryPathParts(name), target });
            // Remove before the decoded name is registered: adm-zip's entry table is keyed by the latin1 name.
            zip.deleteEntry(entry);
            continue;
        }
        const unixDirectory = unixFileType === 0x4000;
        const dosDirectory = (entry.header.made >>> 8) === 0 && entry.header.attr === 0x10;
        if (!entry.isDirectory && (unixDirectory || dosDirectory)) {
            // The setter updates adm-zip's directory flag. Preserve the raw encoding until the name is mapped.
            entry.entryName = entry.rawEntryName.toString('latin1') + '/';
            if (!name.endsWith('/') && !name.endsWith('\\')) {
                name += '/';
            }
        }
        if (names.has(name)) {
            throw new Error(_loc('LIB_OperationFailed', 'extract ZIP', `Duplicate entry name "${name}"`));
        }
        names.add(name);
        decodedNames.set(entry.rawEntryName, name);
        otherEntries.push({ name, parts: entryPathParts(name) });
    }
    validateSymlinks(symlinks, otherEntries, root);
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) {
            continue;
        }
        // Match adm-zip's rooted normalization, including backslashes and traversal segments.
        const entryPath = path.posix.normalize('/' + entry.entryName.replace(/\\/g, '/'));
        const outputPath = path.join(root, entryPath);
        if (fs.existsSync(outputPath) && !fs.statSync(outputPath).isFile()) {
            throw new Error(_loc('LIB_PathIsNotAFile', outputPath));
        }
        if (Buffer.isBuffer(password) && entry.header.encrypted) {
            entry.getData = entry.getData.bind(entry, password);
        }
    }
    const overwrite = options.overwrite ?? true;
    // adm-zip creates directories only per entry, so an empty archive would otherwise leave dir missing.
    fs.mkdirSync(options.dir, { recursive: true });
    zip.extractAllTo(options.dir, overwrite, options.keepOriginalPermission ?? true, options.password);
    createSymlinks(symlinks, root, overwrite);
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
