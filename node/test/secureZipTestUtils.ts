import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as tl from '../_build/task';

export const IS_WINDOWS = os.platform() === 'win32';
export const S_IFREG = 0o100000;
export const S_IFDIR = 0o040000;
export const S_IFLNK = 0o120000;

export interface TestEntry {
    name: string;
    data?: string;
    mode?: number;
}

let crcTable: number[] | undefined;

function crc32(buffer: Buffer): number {
    if (!crcTable) {
        crcTable = [];
        for (let index = 0; index < 256; index++) {
            let value = index;
            for (let bit = 0; bit < 8; bit++) {
                value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
            }
            crcTable.push(value >>> 0);
        }
    }

    let crc = 0xFFFFFFFF;
    for (let index = 0; index < buffer.length; index++) {
        crc = crcTable[(crc ^ buffer[index]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function zipEntry(...segments: string[]): string {
    return segments.join('/');
}

export function buildZip(entries: TestEntry[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    entries.forEach((entry: TestEntry) => {
        const name = Buffer.from(entry.name);
        const data = Buffer.from(entry.data || '');
        const crc = crc32(data);
        const mode = entry.mode === undefined
            ? (entry.name.endsWith('/') ? S_IFDIR | 0o755 : S_IFREG | 0o644)
            : entry.mode;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0x21, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE((3 << 8) | 20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0x21, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE((mode << 16) >>> 0, 38);
        central.writeUInt32LE(offset, 42);

        localParts.push(local, name, data);
        centralParts.push(central, name);
        offset += local.length + name.length + data.length;
    });

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat(localParts.concat([centralDirectory, end]));
}

export async function assertRejects(action: () => Promise<any>, pattern?: RegExp): Promise<void> {
    let error: Error | undefined;
    try {
        await action();
    }
    catch (err) {
        error = err;
    }

    assert(error, 'expected the operation to fail');
    if (pattern) {
        assert(pattern.test(error!.message), 'unexpected error message: ' + error!.message);
    }
}

export function canCreateSymlinks(): boolean {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'securezip-symlink-'));
    try {
        fs.writeFileSync(path.join(directory, 'file1.txt'), '');
        fs.symlinkSync('file1.txt', path.join(directory, 'link.txt'));
        return true;
    }
    catch (err) {
        return false;
    }
    finally {
        tl.rmRF(directory);
    }
}

export function createSource(workDir: string, name: string, files: { [relativePath: string]: string }): string {
    const source = path.join(workDir, name);
    fs.mkdirSync(source);

    Object.keys(files).forEach((relativePath: string) => {
        const fullPath = path.join(source, ...relativePath.split('/'));
        if (relativePath.endsWith('/')) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        else {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, files[relativePath]);
        }
    });

    return source;
}

export function readTree(root: string, relativePath?: string): { [relativePath: string]: string | null } {
    const tree: { [relativePath: string]: string | null } = {};
    fs.readdirSync(path.join(root, relativePath || '')).sort().forEach((name: string) => {
        const child = relativePath ? zipEntry(relativePath, name) : name;
        const fullPath = path.join(root, ...child.split('/'));
        if (fs.statSync(fullPath).isDirectory()) {
            tree[child + '/'] = null;
            Object.assign(tree, readTree(root, child));
        }
        else {
            tree[child] = fs.readFileSync(fullPath, 'utf8');
        }
    });

    return tree;
}
