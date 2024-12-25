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

  before((done) => {
    tl.mkdirP(TEMP_DIR_1);
    tl.mkdirP(TEMP_DIR_2);
    tl.cd(TEMP_DIR_1);

    fs.writeFileSync(TEMP_DIR_2_FILE_1, 'file1');

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

    done();
  });

  afterEach((done) => {
    tl.rmRF(TESTCASE_1);
    tl.rmRF(TESTCASE_2);

    done();
  });

  after((done) => {
    tl.cd(DIRNAME);
    tl.rmRF(TEMP_DIR_1);
    tl.rmRF(TEMP_DIR_2);

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
});