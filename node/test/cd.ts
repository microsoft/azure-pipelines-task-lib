import os = require('node:os');
import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

import * as testutil from './testutil';

describe('cd cases', () => {
  let tempDirPath: string;
  const TEMP_DIR_1 = path.resolve(DIRNAME, 'temp1');
  const TEMP_DIR_2 = path.resolve(DIRNAME, 'temp2');
  const TEMP_FILE_1 = path.resolve(TEMP_DIR_1, 'file1');

  before((done) => {
    fs.mkdirSync(TEMP_DIR_1);
    fs.mkdirSync(TEMP_DIR_2);
    fs.writeFileSync(TEMP_FILE_1, 'file1');

    try {
      testutil.initialize();
    } catch (error) {
      assert.fail(`Failed to load tl lib: ${error.message}`);
    }

    done();
  });

  beforeEach((done) => {
    tempDirPath = fs.mkdtempSync('temp_test_');
    process.chdir(DIRNAME);

    if (!fs.existsSync(tempDirPath)) {
      fs.mkdirSync(tempDirPath);
    }

    done();
  });

  afterEach((done) => {
    process.chdir(DIRNAME);
    if (fs.existsSync(tempDirPath)) {
      fs.rmdirSync(tempDirPath, { recursive: true });
    }

    done();
  });

  after((done) => {
    fs.rmdirSync(TEMP_DIR_1, { recursive: true });
    fs.rmdirSync(TEMP_DIR_2, { recursive: true });
    done();
  });

  it('Check change directory for a folder that doesn\'t exist', (done) => {
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
    tl.cd(tempDirPath);
    assert.equal(path.basename(tempDirPath), tempDirPath);
    done();
  });

  it('Change directory to an absolute path', (done) => {
    tl.cd('/');
    assert.equal(process.cwd(), path.resolve('/'));
    done();
  });

  it('Change directory to a previous directory (-)', (done) => {
    tl.cd('/');
    tl.cd('-');
    assert.ok(process.cwd(), path.resolve(DIRNAME));
    done();
  });

  it('Change directory with cp', (done) => {
    assert.ok(!fs.existsSync(path.resolve(tempDirPath, "file1")));
    tl.cd(TEMP_DIR_1);
    tl.cp(TEMP_FILE_1, path.resolve("..", tempDirPath));
    tl.cd(path.resolve("..", tempDirPath));
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

  it('Change directory to the default home OS directory', (done) => {
    tl.cd();
    assert.ok(process.cwd(), os.homedir());
    done();
  });
});