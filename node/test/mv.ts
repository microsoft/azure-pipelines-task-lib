import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

import * as testutil from './testutil';

describe('mv cases', () => {
  const TEMP_DIR = fs.mkdtempSync(DIRNAME + path.sep);
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
    tl.cd(DIRNAME);
    tl.rmRF(TEMP_DIR);

    done();
  });

  it('Provide an unsupported option argument', (done) => {
    assert.ok(fs.existsSync('file1'));
    assert.doesNotThrow(() => tl.mv('file1', 'file1', '-Z', true));
    assert.ok(fs.existsSync('file1'));

    done();
  });

  it('Provide a source that does not exist', (done) => {
    assert.throws(() => tl.mv('pathdoesnotexist1', '..'), { message: /Failed mv: Error: Not found mv: pathdoesnotexist1/ });
    assert.ok(!fs.existsSync('../pathdoesnotexist2'));

    done();
  });

  it('Provide a source that does not exist, continue on error', (done) => {
    assert.doesNotThrow(() => tl.mv('pathdoesnotexist1', '..', '', true));
    assert.ok(!fs.existsSync('../pathdoesnotexist2'));

    done();
  });

  it('Provide a source that does not exist 2', (done) => {
    assert.throws(() => tl.mv('pathdoesnotexist1', 'pathdoesnotexist2'), { message: /Failed mv: Error: Not found mv: pathdoesnotexist1/ });
    assert.ok(!fs.existsSync('../pathdoesnotexist1'));
    assert.ok(!fs.existsSync('../pathdoesnotexist2'));

    done();
  });

  it('Provide a source that does not exist, continue on error', (done) => {
    assert.doesNotThrow(() => tl.mv('pathdoesnotexist1', 'pathdoesnotexist2', '', true));
    assert.ok(!fs.existsSync('../pathdoesnotexist1'));
    assert.ok(!fs.existsSync('../pathdoesnotexist2'));

    done();
  });

  it('Provide a destination that already exist', (done) => {
    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));

    assert.throws(() => tl.mv('file1', 'file2'), { message: /Failed mv: Error: File already exists at file2/ });

    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));

    done();
  });

  it('Provide a wildcard when dest is file', (done) => {
    assert.throws(() => tl.mv('file*', 'file1'), { message: /Failed mv: Error: File already exists at file1/ });
    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));
    assert.ok(fs.existsSync('file1.js'));
    assert.ok(fs.existsSync('file2.js'));

    done();
  });

  it('Provide a destination that already exist, continue on error', (done) => {
    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));

    assert.doesNotThrow(() => tl.mv('file1', 'file2', '', true));

    assert.ok(fs.existsSync('file1'));
    assert.ok(fs.existsSync('file2'));

    done();
  });

  it('Provide a wildcard when dest is file, continue on error', (done) => {
    assert.doesNotThrow(() => tl.mv('file*', 'file1', '', true));
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