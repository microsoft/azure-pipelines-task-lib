import os = require('node:os');
import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

import * as testutil from './testutil';

describe('rm cases', () => {
  const TEMP_DIR = fs.mkdtempSync(DIRNAME + path.sep);
  const TEMP_NESTED_DIR_LEVEL_1 = path.join(TEMP_DIR, 'a');
  const TEMP_NESTED_DIR_FULL_TREE = path.join(TEMP_NESTED_DIR_LEVEL_1, 'b', 'c');
  const TEMP_FILE_1 = path.join(TEMP_DIR, 'file1');

  before((done) => {
    try {
      testutil.initialize();
    } catch (error) {
      assert.fail(`Failed to load tl lib: ${error.message}`);
    }

    fs.writeFileSync(TEMP_FILE_1, 'test');

    done();
  });

  after((done) => {
    tl.cd(DIRNAME)
    tl.rmRF(TEMP_DIR);

    done();
  });

  it('Invalid arguments', (done) => {
    assert.doesNotThrow(() => tl.rmRF('somefolderpaththatdoesnotexist'));
    done();
  });

  it('Remove TEMP_FILE_1', (done) => {
    assert.ok(fs.existsSync(TEMP_FILE_1));
    assert.doesNotThrow(() => tl.rmRF(TEMP_FILE_1));
    assert.ok(!fs.existsSync(TEMP_FILE_1));

    done();
  });

  it('Remove subdirectory recursive at TEMP_NESTED_DIR_LEVEL_1', (done) => {
    tl.mkdirP(TEMP_NESTED_DIR_FULL_TREE);

    assert.ok(fs.existsSync(TEMP_NESTED_DIR_FULL_TREE));
    assert.doesNotThrow(() => tl.rmRF(TEMP_NESTED_DIR_LEVEL_1));
    assert.ok(!fs.existsSync(TEMP_NESTED_DIR_LEVEL_1));

    done();
  });

  it('Remove subdirectory recursive at TEMP_NESTED_DIR_LEVEL_1 with absolute path', (done) => {
    tl.mkdirP(TEMP_NESTED_DIR_FULL_TREE);

    assert.ok(fs.existsSync(TEMP_NESTED_DIR_FULL_TREE));
    assert.doesNotThrow(() => tl.rmRF(path.resolve(`./${TEMP_NESTED_DIR_LEVEL_1}`)));
    assert.ok(!fs.existsSync(`./${TEMP_NESTED_DIR_LEVEL_1}`));

    done();
  });

  it('Remove a read-only file inside temp readonly dir', (done) => {
    const READONLY_DIR = path.join(TEMP_DIR, 'readonly');
    tl.mkdirP(READONLY_DIR);
    fs.writeFileSync(path.join(READONLY_DIR, 'file'), 'test');
    fs.chmodSync(path.join(READONLY_DIR, 'file'), '0444');

    assert.doesNotThrow(() => tl.rmRF(path.join(READONLY_DIR, 'file')));
    assert.ok(!fs.existsSync(path.join(READONLY_DIR, 'file')));
    assert.doesNotThrow(() => tl.rmRF(READONLY_DIR));

    done();
  });

  it('Remove of a tree containing read-only files (forced)', (done) => {
    tl.mkdirP(path.join(TEMP_DIR, 'tree'));
    fs.writeFileSync(path.join(TEMP_DIR, 'tree', 'file1'), 'test');
    fs.writeFileSync(path.join(TEMP_DIR, 'tree', 'file2'), 'test');
    fs.chmodSync(path.join(TEMP_DIR, 'tree', 'file1'), '0444');

    assert.doesNotThrow(() => tl.rmRF(path.join(TEMP_DIR, 'tree')));
    assert.ok(!fs.existsSync(path.join(TEMP_DIR, 'tree')));

    done();
  });

  it('removal of a sub-tree containing read-only and hidden files - without glob', (done) => {
    const TEMP_TREE4_DIR = path.join(TEMP_DIR, 'tree4');
    tl.mkdirP(path.join(TEMP_TREE4_DIR, 'subtree'));
    tl.mkdirP(path.join(TEMP_TREE4_DIR, '.hidden'));
    fs.writeFileSync(path.join(TEMP_TREE4_DIR, 'subtree', 'file'), 'test');
    fs.writeFileSync(path.join(TEMP_TREE4_DIR, '.hidden', 'file'), 'test');
    fs.writeFileSync(path.join(TEMP_TREE4_DIR, 'file'), 'test');
    fs.chmodSync(path.join(TEMP_TREE4_DIR, 'file'), '0444');
    fs.chmodSync(path.join(TEMP_TREE4_DIR, 'subtree', 'file'), '0444');
    fs.chmodSync(path.join(TEMP_TREE4_DIR, '.hidden', 'file'), '0444');

    assert.doesNotThrow(() => tl.rmRF(path.join(TEMP_DIR, 'tree4')));
    assert.ok(!fs.existsSync(path.join(TEMP_DIR, 'tree4')));

    done();
  });

  it('Remove path with relative non-normalized structure', (done) => {
    tl.mkdirP(TEMP_NESTED_DIR_FULL_TREE);

    assert.ok(fs.existsSync(TEMP_NESTED_DIR_FULL_TREE));
    assert.doesNotThrow(() => tl.rmRF(path.join(TEMP_DIR, 'a', '..', './a')));
    assert.ok(!fs.existsSync(path.join(TEMP_DIR, 'a')));

    done();
  });

  it('Removing symbolic link to a file', (done) => {
    const filePath = path.join(TEMP_DIR, 'file');
    const linkPath = path.join(TEMP_DIR, 'link_to_file');
    fs.writeFileSync(filePath, 'test');
    fs.symlinkSync(filePath, linkPath);

    assert.ok(fs.existsSync(linkPath));
    assert.doesNotThrow(() => tl.rmRF(linkPath));
    assert.ok(!fs.existsSync(linkPath));
    assert.ok(fs.existsSync(filePath));

    done();
  });

  it('Removing symbolic link to a directory and its contents', (done) => {
    const dirPath = path.join(TEMP_DIR, 'dir');
    const linkPath = path.join(TEMP_DIR, 'link_to_dir');

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, 'file_in_dir'), 'test');
    fs.symlinkSync(dirPath, linkPath, 'dir');
    assert.ok(fs.existsSync(linkPath));

    assert.doesNotThrow(() => tl.rmRF(linkPath));

    assert.ok(!fs.existsSync(linkPath));
    assert.ok(!fs.existsSync(dirPath));
    done();
  });

  it('Remove a symlink after deleting the source file', (done) => {
    const filePath = path.join(TEMP_DIR, 'source_file.txt');
    const linkPath = path.join(TEMP_DIR, 'link_to_source_file');
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    fs.writeFileSync(filePath, 'This is a test file.');
    fs.symlinkSync(filePath, linkPath);
    assert.ok(fs.existsSync(linkPath), 'Symbolic link should exist');
    fs.unlinkSync(filePath);
    assert.ok(!fs.existsSync(filePath), 'Source file should be deleted');
    assert.doesNotThrow(() => tl.rmRF(linkPath));
    assert.ok(!fs.existsSync(linkPath), 'Symbolic link should be removed');
    done();
  });

  it('Remove a symlink after deleting the source directory', (done) => {
    const dirPath = path.join(TEMP_DIR, 'source_dir');
    const linkPath = path.join(TEMP_DIR, 'link_to_source_dir');
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    fs.mkdirSync(dirPath, { recursive: true });

    if (process.platform === 'win32') {
      fs.symlinkSync(dirPath, linkPath, 'junction');
    } else {
      fs.symlinkSync(dirPath, linkPath);
    }

    assert.ok(fs.existsSync(linkPath), 'Symbolic link should exist');
    fs.rmdirSync(dirPath, { recursive: true });
    assert.ok(!fs.existsSync(dirPath), 'Source directory should be deleted');
    assert.doesNotThrow(() => tl.rmRF(linkPath));
    assert.ok(!fs.existsSync(linkPath), 'Symbolic link should be removed');
    done();
  });

});