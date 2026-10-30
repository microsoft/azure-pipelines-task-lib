import type AdmZip = require('adm-zip');
import fs = require('fs');
import path = require('path');
import { _loc } from './internal';

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
    const zip = new Zip(file);
    const password = options.password;
    for (const entry of zip.getEntries()) {
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
