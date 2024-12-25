import os = require('node:os');
import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

import * as testutil from './testutil';

describe('cd cases', () => {
  let TEMP_DIR_PATH: string;
  const TEMP_DIR_1 = path.resolve(DIRNAME, 'temp1');
  const TEMP_DIR_2 = path.resolve(DIRNAME, 'temp2');
  const TEMP_FILE_1 = path.resolve(TEMP_DIR_1, 'file1');

  before((done) => {
    process.chdir(DIRNAME);
    TEMP_DIR_PATH = fs.mkdtempSync('temp_test_');
    tl.mkdirP(TEMP_DIR_1);
    tl.mkdirP(TEMP_DIR_2);
    fs.writeFileSync(TEMP_FILE_1, 'file1');

    try {
      testutil.initialize();
    } catch (error) {
      assert.fail(`Failed to load tl lib: ${error.message}`);
    }

    done();
  });

  after((done) => {
    tl.cd(DIRNAME);
    tl.rmRF(TEMP_DIR_1);
    tl.rmRF(TEMP_DIR_2);
    tl.rmRF(TEMP_DIR_PATH);

    done();
  });

  it('Check change directory for a folder that does not exist', (done) => {
    assert.ok(!fs.existsSync('/thisfolderdoesnotexist'));
    assert.throws(() => tl.cd('/thisfolderdoesnotexist'), { message: "Failed cd: no such file or directory: /thisfolderdoesnotexist" });

    done();
  });

  it('Change directory to a file path', (done) => {
    const filePath = path.resolve(DIRNAME, 'scripts', 'match-input-exe.cs');

    assert.ok(fs.existsSync(filePath));
    assert.throws(() => tl.cd(filePath), { message: `Failed cd: not a directory: ${filePath}` });

    done();
  });

  it('There is no previous directory', (done) => {
    assert.throws(() => tl.cd('-'), { message: 'Failed cd: could not find previous directory' });

    done();
  });

  it('Change direcotry to a relative path', (done) => {
    tl.cd(TEMP_DIR_PATH);

    assert.equal(path.basename(TEMP_DIR_PATH), TEMP_DIR_PATH);

    done();
  });

  it('Change directory to an absolute path', (done) => {
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
    assert.ok(!fs.existsSync(path.resolve(TEMP_DIR_PATH, "file1")));

    tl.cd(TEMP_DIR_1);
    tl.cp(TEMP_FILE_1, path.resolve("..", TEMP_DIR_PATH));
    tl.cd(path.resolve("..", TEMP_DIR_PATH));

    assert.ok(fs.existsSync('file1'));

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