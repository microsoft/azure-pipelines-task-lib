import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

import * as testutil from './testutil';

describe('mv cases', () => {
  const TEMP_DIR = fs.mkdtempSync(DIRNAME + '/');
  let TEMP_FILE_1: string;
  let TEMP_FILE_1_JS: string;
  let TEMP_FILE_2: string;
  let TEMP_FILE_2_JS: string;

  before((done) => {
    try {
      testutil.initialize();
    } catch (error) {
      assert.fail(`Failed to load tl lib: ${error.message}`);
    }

    tl.cd(TEMP_DIR);
    done();
  });

  beforeEach((done) => {
    TEMP_FILE_1 = path.join(TEMP_DIR, 'file1');
    fs.writeFileSync(TEMP_FILE_1, 'test');
    TEMP_FILE_1_JS = path.join(TEMP_DIR, 'file1.js');
    fs.writeFileSync(TEMP_FILE_1_JS, 'test');
    TEMP_FILE_2 = path.join(TEMP_DIR, 'file2');
    fs.writeFileSync(TEMP_FILE_2, 'test');
    TEMP_FILE_2_JS = path.join(TEMP_DIR, 'file2.js');
    fs.writeFileSync(TEMP_FILE_2_JS, 'test');

    done();
  });

  after((done) => {
    fs.rmSync(TEMP_DIR, { recursive: true });
    done();
  });

  it('Provide invalid arguments', (done) => {
    // @ts-ignore
    assert.doesNotThrow(() => tl.mv());
    // @ts-ignore
    assert.doesNotThrow(() => tl.mv('file1'));
    // @ts-ignore
    assert.doesNotThrow(() => tl.mv('-f'));
    done();
  });

  it('Provide an unsupported option argument', (done) => {
    assert.ok(fs.existsSync('file1'));
    assert.doesNotThrow(() => tl.mv('file1', 'file1', '-Z'));
    assert.ok(fs.existsSync('file1'));
    done();
  });

  it('Provide a source that does not exist', (done) => {
    assert.doesNotThrow(() => tl.mv('pathdoesntexist1', '..'));
    assert.ok(!fs.existsSync('../pathdoesntexist2'));
    done();
  });

  it('Provide a source that does not exist', (done) => {
    assert.doesNotThrow(() => tl.mv('pathdoesntexist1', 'pathdoesntexist2', '..'));
    assert.ok(!fs.existsSync('../pathdoesntexist1'));
    assert.ok(!fs.existsSync('../pathdoesntexist2'));
    done();
  });

  it('Provide a destination that already exist', (done) => {
    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));
    assert.doesNotThrow(() => tl.mv('file1', 'file2'));
    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));
    done();
  });

  it('Provide a wildcard when dest is file', (done) => {
    assert.doesNotThrow(() => tl.mv('file*', 'file1'));
    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));
    assert.ok(fs.existsSync('file1.js'));
    assert.ok(fs.existsSync('file2.js'));
    done();
  });

  it('Move a file and rollback', (done) => {
    assert.ok(fs.existsSync('file1'));
    tl.mv('file1', 'file3');
    assert.ok(!fs.existsSync('file1'));
    assert.ok(fs.existsSync('file3'));
    tl.mv('file3', 'file1');
    assert.ok(fs.existsSync('file1'));
    done();
  });

  it('Move to an existed path with -f attribute', (done) => {
    assert.ok(fs.existsSync('file1'));
    assert.doesNotThrow(() => tl.mv('file1', 'file2', '-f'));
    assert.ok(!fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));
    done();
  });
});