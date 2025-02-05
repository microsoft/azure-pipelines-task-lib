import os = require('node:os');
import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

import * as testutil from './testutil';

describe('cd cases', () => {
  const TEMP_DIR_1 = path.resolve(DIRNAME, 'temp1');
  const TEMP_DIR_2 = path.resolve(DIRNAME, 'temp2');
  const TEMP_DIR_2_SUBDIR_1 = path.resolve(TEMP_DIR_2, 'subdir1');
  const TEMP_FILE_1 = path.resolve(TEMP_DIR_1, 'file1');
  const TEMP_DIR_2_SUBDIR_1_FILE_1 = path.resolve(TEMP_DIR_2_SUBDIR_1, 'file1');
  const TEMP_DIR_2_SUBDIR_1_SYMLINK_FILE_1 = path.resolve(TEMP_DIR_2_SUBDIR_1, 'symlink_file_1');
  const TEMP_DIR_2_SUBDIR_1_SYMLINK_DIR_1 = path.resolve(TEMP_DIR_2_SUBDIR_1, 'symlink_dir_1');

  before((done) => {
    process.chdir(DIRNAME);

    tl.mkdirP(TEMP_DIR_1);
    tl.mkdirP(TEMP_DIR_2);
    tl.mkdirP(TEMP_DIR_2_SUBDIR_1);
    fs.writeFileSync(TEMP_FILE_1, 'file1');
    fs.writeFileSync(TEMP_DIR_2_SUBDIR_1_FILE_1, 'file1');
    fs.symlinkSync(TEMP_FILE_1, TEMP_DIR_2_SUBDIR_1_SYMLINK_FILE_1);
    fs.symlinkSync(TEMP_DIR_1, TEMP_DIR_2_SUBDIR_1_SYMLINK_DIR_1);

    try {
      testutil.initialize();
    } catch (error) {
      assert.fail(`Failed to load tl lib: ${error.message}`);
    }

    done();
  });

  beforeEach(() => {
    process.env.OLDPWD = '';
    process.chdir(DIRNAME);
  });

  after((done) => {
    tl.cd(DIRNAME);
    tl.rmRF(TEMP_DIR_1);
    tl.rmRF(TEMP_DIR_2);

    done();
  });

  it('Provide a path does not exist', (done) => {
    assert.ok(!fs.existsSync('/thisfolderdoesnotexist'));
    assert.throws(() => tl.cd('/thisfolderdoesnotexist'), { message: 'Not found cd: /thisfolderdoesnotexist' });
    done();
  });

  it('Provide all suite possible directories', (done) => {
    assert.equal(process.cwd(), DIRNAME);

    tl.cd(TEMP_DIR_1);
    assert.equal(process.cwd(), TEMP_DIR_1);

    tl.cd(TEMP_DIR_2);
    assert.equal(process.cwd(), TEMP_DIR_2);

    tl.cd(TEMP_DIR_2_SUBDIR_1);
    assert.equal(process.cwd(), TEMP_DIR_2_SUBDIR_1);

    tl.cd(TEMP_DIR_2_SUBDIR_1_SYMLINK_DIR_1);
    assert.equal(fs.realpathSync('.'), TEMP_DIR_1);

    assert.equal(process.env.OLDPWD, TEMP_DIR_2_SUBDIR_1);

    done();
  });

  it('Provide path that is a file path', (done) => {
    assert.ok(fs.existsSync(TEMP_FILE_1));
    assert.throws(() => tl.cd(TEMP_FILE_1), { message: `Path is not a directory: ${TEMP_FILE_1}` });
    done();
  });

  it('Provide path that is a file symlink', (done) => {
    assert.ok(fs.existsSync(TEMP_DIR_2_SUBDIR_1_SYMLINK_FILE_1));
    assert.throws(() => tl.cd(TEMP_DIR_2_SUBDIR_1_SYMLINK_FILE_1), { message: `Path is not a directory: ${TEMP_DIR_2_SUBDIR_1_SYMLINK_FILE_1}` });
    done();
  });

  it('Provide path that is a dir symlink', (done) => {
    assert.ok(fs.existsSync(TEMP_DIR_2_SUBDIR_1_SYMLINK_DIR_1));
    assert.doesNotThrow(() => tl.cd(TEMP_DIR_2_SUBDIR_1_SYMLINK_DIR_1));
    assert.equal(fs.realpathSync('.'), TEMP_DIR_1);
    done();
  });

  it('Check if there is no previous directory', (done) => {
    assert.throws(() => tl.cd('-'), { message: 'Could not find previous directory' });
    done();
  });

  it('Provide a relative directory path', (done) => {
    const relativePath = path.relative(process.cwd(), TEMP_DIR_1);
    tl.cd(relativePath);
    assert.equal(path.basename(relativePath), relativePath);
    done();
  });

  it('Provide an absolute directory path', (done) => {
    tl.cd('/');
    assert.equal(process.cwd(), path.resolve('/'));
    done();
  });

  it('Change directory to a previous directory -', (done) => {
    tl.cd('/');
    tl.cd('-');
    assert.ok(process.cwd(), path.resolve(DIRNAME));
    done();
  });

  it('Change directory with cp', (done) => {
    const TEMP_DIR_2_FILE_1 = path.resolve(TEMP_DIR_2, 'file1');
    assert.ok(!fs.existsSync(TEMP_DIR_2_FILE_1));

    tl.cd(TEMP_DIR_1);
    tl.cp(TEMP_FILE_1, path.resolve("..", TEMP_DIR_2));
    tl.cd(path.resolve("..", TEMP_DIR_2));

    assert.ok(fs.existsSync(TEMP_DIR_2_FILE_1));

    done();
  });

  it('Using the tilde expansion', (done) => {
    tl.cd('~');
    assert.ok(process.cwd(), os.homedir());
    tl.cd('..');
    assert.notEqual(process.cwd(), os.homedir());
    tl.cd('~');
    assert.equal(process.cwd(), os.homedir());

    done();
  });
});