// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type AdmZip = require('adm-zip');

export interface ExtractZipOptions {
    dir: string;
    /** Whether existing files are overwritten. Defaults to false. */
    overwrite?: boolean;
    /** Whether archive permissions are restored. Defaults to false. */
    keepOriginalPermission?: boolean;
    password?: string | Buffer;
}

export interface CreateZipOptions {
    /** Folder inside the archive. Defaults to the archive root. */
    zipPath?: string;
    filter?: AdmZip.EntryFilter;
}

/** Extracts a ZIP synchronously and returns the destination. Requires Node.js 14 or newer. */
export function extractZipSync(file: string, destination: string | ExtractZipOptions): string {
    if (!file) {
        throw new Error('Parameter "file" must be set.');
    }
    const options: ExtractZipOptions = typeof destination === 'string' ? { dir: destination } : destination;
    if (!options || !options.dir) {
        throw new Error('Parameter "dir" must be set.');
    }
    const Zip: typeof AdmZip = require('adm-zip');
    const zip = new Zip(file);
    console.log(`Extracting ZIP file: ${file} to destination: ${options.dir} with overwrite: ${options.overwrite}, keepOriginalPermission: ${options.keepOriginalPermission}`);
    zip.extractAllTo(options.dir, options.overwrite, options.keepOriginalPermission, options.password);
    return options.dir;
}

/** Promise wrapper around extractZipSync. ZIP processing still runs synchronously. */
export async function extractZip(file: string, destination: string | ExtractZipOptions): Promise<string> {
    return extractZipSync(file, destination);
}

/** Archives a folder's contents synchronously and returns the ZIP path. Requires Node.js 14 or newer. */
export function createZipSync(sourceDirectory: string, destinationZip: string, options?: CreateZipOptions): string {
    if (!sourceDirectory) {
        throw new Error('Parameter "sourceDirectory" must be set.');
    }
    if (!destinationZip) {
        throw new Error('Parameter "destinationZip" must be set.');
    }
    const Zip: typeof AdmZip = require('adm-zip');
    const zip = new Zip();
    console.log(`Creating ZIP from source directory: ${sourceDirectory} to destination: ${destinationZip} with zipPath: ${options && options.zipPath}, filter: ${options && options.filter}`);
    zip.addLocalFolder(sourceDirectory, options && options.zipPath, options && options.filter);
    zip.writeZip(destinationZip);
    return destinationZip;
}

/** Promise wrapper around createZipSync. ZIP processing still runs synchronously. */
export async function createZip(sourceDirectory: string, destinationZip: string, options?: CreateZipOptions): Promise<string> {
    return createZipSync(sourceDirectory, destinationZip, options);
}
