import path = require('path');
import im = require('./internal');

const MIN_NODE_MAJOR = 12;

export const S_IFDIR = 0x4000;
export const S_IFLNK = 0xA000;

export function isWithinDirectory(root: string, candidate: string): boolean {
    const relativePath = path.relative(root, candidate);
    return relativePath === '' ||
        (!path.isAbsolute(relativePath) && relativePath.split(path.sep).indexOf('..') < 0);
}

export function assertSupportedNode(): void {
    if (parseInt(process.versions.node.split('.')[0], 10) < MIN_NODE_MAJOR) {
        throw new Error(im._loc('LIB_ArchiveUnsupportedNode', process.versions.node));
    }
}
