import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

import * as testutil from './testutil';

describe('cp cases', () => {
  const TEMP_DIR_1 = path.resolve(DIRNAME, 'temp1');
  const TEMP_DIR_2 = path.resolve(DIRNAME, 'temp2');
  const TEMP_DIR_2_FILE_1 = path.resolve(TEMP_DIR_2, 'file1');
  const TESTCASE_1 = path.resolve(TEMP_DIR_1, 'testcase_1');
  const TESTCASE_2 = path.resolve(TEMP_DIR_1, 'testcase_2');
  const TEST_SRC_DIR = path.resolve(DIRNAME, 'test-src');
  const TEST_DEST_DIR = path.resolve(DIRNAME, 'test-dest');
  const OUTSIDE_FILE = path.resolve(DIRNAME, 'outside-file.txt');
  const RELATIVE_TARGET_FILE = path.resolve(TEST_SRC_DIR, 'relative-file.txt');
  const ABSOLUTE_SYMLINK = 'symlink-outside.txt';
  const RELATIVE_SYMLINK = 'symlink-relative.txt';
  const GLOB_TEST_DIR = path.resolve(DIRNAME, 'glob-test');
  const GLOB_DEST_DIR = path.resolve(DIRNAME, 'glob-dest');

  before((done) => {
    tl.mkdirP(TEMP_DIR_1);
    tl.mkdirP(TEMP_DIR_2);
    fs.mkdirSync(TEST_SRC_DIR, { recursive: true });
    const symlinkPath = path.join(TEST_SRC_DIR, ABSOLUTE_SYMLINK);
    fs.writeFileSync(OUTSIDE_FILE, 'This is a file outside the source folder.');
    fs.writeFileSync(RELATIVE_TARGET_FILE, 'This is the file which is inside the source folder.');
    fs.symlinkSync(OUTSIDE_FILE, symlinkPath);
    fs.mkdirSync(TEST_DEST_DIR, { recursive: true });
    fs.writeFileSync(TEMP_DIR_2_FILE_1, 'file1');
    const symlinkPath2 = path.join(TEST_SRC_DIR, RELATIVE_SYMLINK);
    const targetPath = path.relative(TEST_SRC_DIR, RELATIVE_TARGET_FILE);
    fs.symlinkSync(targetPath, symlinkPath2, 'file');
    tl.mkdirP(GLOB_TEST_DIR);
    tl.mkdirP(GLOB_DEST_DIR);
    fs.writeFileSync(path.join(GLOB_TEST_DIR, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(GLOB_TEST_DIR, 'file2.txt'), 'content2');
    fs.writeFileSync(path.join(GLOB_TEST_DIR, 'file3.log'), 'content3');
    fs.writeFileSync(path.join(GLOB_TEST_DIR, 'test.txt'), 'test content');

    try {
      testutil.initialize();
    } catch (error) {
      assert.fail(`Failed to load tl lib: ${error.message}`);
    }

    done();
  });

  beforeEach((done) => {
    fs.writeFileSync(TESTCASE_1, 'testcase_1');
    fs.writeFileSync(TESTCASE_2, 'testcase_2');
    tl.mkdirP(GLOB_DEST_DIR);
    done();
  });

  afterEach((done) => {
    tl.rmRF(TESTCASE_1);
    tl.rmRF(TESTCASE_2);
    tl.rmRF(GLOB_DEST_DIR);    
    done();
  });

  after((done) => {
    tl.cd(DIRNAME);
    tl.rmRF(TEMP_DIR_1);
    tl.rmRF(TEMP_DIR_2);
    tl.rmRF(OUTSIDE_FILE);
    tl.rmRF(GLOB_DEST_DIR);
    tl.rmRF(GLOB_TEST_DIR);
    fs.rmSync(TEST_SRC_DIR, { recursive: true, force: true });
    fs.rmSync(TEST_DEST_DIR, { recursive: true, force: true })
    done();
  });

  it('Provide the source that does not exist', (done) => {
    assert.throws(() => tl.cp('pathdoesnotexist', TEMP_DIR_1), { message: /^ENOENT: no such file or directory/ });
    assert.ok(!fs.existsSync(path.join(TEMP_DIR_1, 'pathdoesnotexist')));

    done();
  });

  it('Provide the source as empty string', (done) => {
    assert.throws(() => tl.cp('', 'pathdoesnotexist'), { message: /^ENOENT: no such file or directory/ });

    done();
  });

  it('Provide the destination as empty string', (done) => {
    assert.throws(() => tl.cp('pathdoesnotexist', ''), { message: /^ENOENT: no such file or directory/ });

    done();
  });

  it('Provide -n attribute to prevent overwrite an existing file at the destination', (done) => {
    assert.doesNotThrow(() => tl.cp('-n', TESTCASE_1, TESTCASE_2));
    assert.equal(fs.readFileSync(TESTCASE_2, 'utf8'), 'testcase_2');

    done();
  });

  it('Provide two paths, check force default behavior', (done) => {
    assert.doesNotThrow(() => tl.cp(TESTCASE_1, TESTCASE_2));
    assert.equal(fs.readFileSync(TESTCASE_2, 'utf8'), 'testcase_1');

    done();
  });

  it('Provide two paths, check explicitly force attribute', (done) => {
    assert.doesNotThrow(() => tl.cp('-f', TESTCASE_1, TESTCASE_2));
    assert.equal(fs.readFileSync(TESTCASE_2, 'utf8'), 'testcase_1');

    done();
  });

  it('Check copying a file to a dir', (done) => {
    assert.doesNotThrow(() => tl.cp(TESTCASE_1, TEMP_DIR_2));
    assert.ok(fs.existsSync(path.join(TEMP_DIR_2, 'testcase_1')));
    assert.equal(fs.readFileSync(path.join(TEMP_DIR_2, 'testcase_1'), 'utf8'), 'testcase_1');

    done();
  });

  it('Check copying file to a file', (done) => {
    assert.doesNotThrow(() => tl.cp(TESTCASE_2, path.join(TEMP_DIR_2, 'testcase_3')));
    assert.ok(fs.existsSync(path.join(TEMP_DIR_2, 'testcase_3')));
    assert.equal(fs.readFileSync(path.join(TEMP_DIR_2, 'testcase_3'), 'utf8'), 'testcase_2');

    done();
  });

  it('Check copying file to an existed file with -f option', (done) => {
    assert.ok(fs.existsSync(TESTCASE_1));
    assert.ok(fs.existsSync(TESTCASE_2));
    assert.equal(fs.readFileSync(TESTCASE_1, 'utf8'), 'testcase_1');
    assert.equal(fs.readFileSync(TESTCASE_2, 'utf8'), 'testcase_2');

    assert.doesNotThrow(() => tl.cp('-f', TESTCASE_1, TESTCASE_2));

    assert.ok(fs.existsSync(TESTCASE_1));
    assert.ok(fs.existsSync(TESTCASE_2));
    assert.equal(fs.readFileSync(TESTCASE_1, 'utf8'), 'testcase_1');
    assert.equal(fs.readFileSync(TESTCASE_2, 'utf8'), 'testcase_1');

    done();
  });

  it('Check copying file to an existed file with -n option', (done) => {
    assert.ok(fs.existsSync(TESTCASE_1));
    assert.ok(fs.existsSync(TESTCASE_2));
    assert.equal(fs.readFileSync(TESTCASE_1, 'utf8'), 'testcase_1');
    assert.equal(fs.readFileSync(TESTCASE_2, 'utf8'), 'testcase_2');

    assert.doesNotThrow(() => tl.cp('-n', TESTCASE_1, TESTCASE_2));

    assert.ok(fs.existsSync(TESTCASE_1));
    assert.ok(fs.existsSync(TESTCASE_2));
    assert.equal(fs.readFileSync(TESTCASE_1, 'utf8'), 'testcase_1');
    assert.equal(fs.readFileSync(TESTCASE_2, 'utf8'), 'testcase_2');

    done();
  });

  it('copy a directory containing symbolic link recursively', (done) => {

    tl.cp(TEST_SRC_DIR, TEST_DEST_DIR, '-r', false, 0);

    // Verify first symlink
    assert(fs.existsSync(path.join(TEST_DEST_DIR, 'test-src')), 'Directory was not copied');
    assert(fs.existsSync(path.join(TEST_DEST_DIR, 'test-src', ABSOLUTE_SYMLINK)), 'File was not copied');
    assert.equal(fs.readFileSync(path.join(TEST_DEST_DIR, 'test-src', ABSOLUTE_SYMLINK), 'utf8'), 'This is a file outside the source folder.', 'File content is incorrect');
    assert(!fs.existsSync(path.join(TEST_DEST_DIR, 'test-src', 'outside-file.txt')), 'First symbolic link should not be resolved');

    // Verify second symlink with relative path
    assert(fs.existsSync(path.join(TEST_DEST_DIR, 'test-src', RELATIVE_SYMLINK)), 'Second file was not copied');
    assert.equal(
      fs.readFileSync(path.join(TEST_DEST_DIR, 'test-src', RELATIVE_SYMLINK), 'utf8'),
      'This is the file which is inside the source folder.',
      'Second file content is incorrect'
    );

    done();
  });

  it('copy symlink pointing to file where symlink is created using relative path to target file', (done) => {
    const rootSymlinkName = 'root-symlink-to-outside-file';
    const symlinkPath = path.join(TEMP_DIR_1, rootSymlinkName);
    const targetPath = path.relative(TEMP_DIR_1, OUTSIDE_FILE);

    fs.symlinkSync(targetPath, symlinkPath, 'file');

    const destPath = path.join(TEMP_DIR_2, rootSymlinkName);
    tl.cp(symlinkPath, destPath);
    assert(fs.existsSync(destPath), 'Destination file was not created');
    assert(fs.lstatSync(destPath).isSymbolicLink(), 'Destination should be a symlink');
    assert.equal(fs.readFileSync(destPath, 'utf8'), 'This is a file outside the source folder.', 'File content does not match source');

    done();
  });
  it('Throws if no arguments are provided', (done) => {
    assert.throws(() => (tl as any).cp(), /ENOENT|missing/i);
    done();
  });

  it('Throws if only source is provided', (done) => {
    assert.throws(() => (tl as any).cp('file1'), /ENOENT|missing/i);
    done();
  });

  it('Recursive copy works with trailing slash', (done) => {
    tl.mkdirP('dirA');
    fs.writeFileSync(path.join('dirA', 'file.txt'), 'abc');
    assert.doesNotThrow(() => tl.cp('-r', 'dirA/', 'dirB'));
    assert.ok(fs.existsSync(path.join('dirB', 'file.txt')));
    tl.rmRF('dirA');
    tl.rmRF('dirB');
    done();
  });

  it('Recursive copy works when the destination is not present', (done) => {
    tl.mkdirP('dirA');
    fs.writeFileSync(path.join('dirA', 'file.txt'), 'abc');
    assert.doesNotThrow(() => tl.cp('-r', 'dirA', 'dirB'));
    assert.ok(fs.existsSync(path.join('dirB', 'file.txt')));
    tl.rmRF('dirA');
    tl.rmRF('dirB');
    done();
  });

  it('Recursive copy works when the destination is present(copies entire source in to dest)', (done) => {
    tl.mkdirP('dirA');
    tl.mkdirP('dirB');
    fs.writeFileSync(path.join('dirA', 'file.txt'), 'abc');
    assert.doesNotThrow(() => tl.cp('-r', 'dirA', 'dirB'));
    assert.ok(fs.existsSync(path.join('dirB', 'dirA', 'file.txt')));
    tl.rmRF('dirA');
    tl.rmRF('dirB');
    done();
  });

  it('cp with * pattern', (done) => {
    const pattern = path.join(GLOB_TEST_DIR, '\\*');
    assert.doesNotThrow(() => tl.cp(pattern, GLOB_DEST_DIR));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file1.txt')));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file2.txt')));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'test.txt')));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file3.log')));

    done();
  });

  it('cp with ? pattern matches single character', (done) => {
    
    const pattern = path.join(GLOB_TEST_DIR, 'file?.txt');
    assert.doesNotThrow(() => tl.cp(pattern, GLOB_DEST_DIR));

    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file1.txt')));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file2.txt')));
    assert.ok(!fs.existsSync(path.join(GLOB_DEST_DIR, 'test.txt')));
    assert.ok(!fs.existsSync(path.join(GLOB_DEST_DIR, 'file3.log')));

    done();
  });

  it('cp with [character set] pattern', (done) => {
    const pattern = path.join(GLOB_TEST_DIR, 'file[12].txt');
    assert.doesNotThrow(() => tl.cp(pattern, GLOB_DEST_DIR));

    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file1.txt')));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file2.txt')));
    assert.ok(!fs.existsSync(path.join(GLOB_DEST_DIR, 'file3.log')));

    done();
  });

  it('cp with combined ? and [pattern] patterns', (done) => {
    const pattern = path.join(GLOB_TEST_DIR, 'file[1-3].???');
    assert.doesNotThrow(() => tl.cp(pattern, GLOB_DEST_DIR));

    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file1.txt')));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file2.txt')));
    assert.ok(fs.existsSync(path.join(GLOB_DEST_DIR, 'file3.log')));

    done();
  });
  
  it('cp with pattern that matches no files throws error', (done) => {
    const pattern = path.join(GLOB_TEST_DIR, 'nonexistent?.txt');
    assert.throws(() => tl.cp(pattern, GLOB_DEST_DIR), /No files found matching pattern/);
    done();
  });

  it('Handles non-normalized paths', (done) => {
    tl.mkdirP('dirC');
    fs.writeFileSync(path.join('dirC', 'file.txt'), 'abc');
    const nonNormalized = path.join('.', 'dirC', '.', '..', 'dirC');
    assert.doesNotThrow(() => tl.cp('-r', nonNormalized, 'dirD'));
    assert.ok(fs.existsSync(path.join('dirD', 'file.txt')));
    tl.rmRF('dirC');
    tl.rmRF('dirD');
    done();
  });
});