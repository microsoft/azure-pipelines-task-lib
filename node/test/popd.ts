import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const DIRNAME = __dirname;

function reset() {
  while (true) {
    try {
      const stack = tl.popd();

      if (stack.length === 0) {
        break;
      }
    } catch {
      break;
    }
  }

  tl.cd(DIRNAME);
}

describe('popd cases', () => {
  const TEMP_DIR_PATH = path.resolve('test_pushd', 'nested', 'dir');

  before(() => {
    tl.mkdirP(path.resolve(DIRNAME, TEMP_DIR_PATH, 'a'));
    tl.mkdirP(path.resolve(DIRNAME, TEMP_DIR_PATH, 'b', 'c'));
  });

  beforeEach(() => {
    reset();
  });

  after(() => {
    tl.cd(DIRNAME);
    reset();
    tl.rmRF(path.resolve(DIRNAME, TEMP_DIR_PATH));
  });

  it('The default usage', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd();

    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [DIRNAME]);

    done();
  });

  it('Using two directories on the stack', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    const trail = tl.popd();

    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(DIRNAME, TEMP_DIR_PATH),
      DIRNAME,
    ]);

    done();
  });

  it('Using three directories on the stack', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('b');
    tl.pushd('c');
    const trail = tl.popd();

    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(TEMP_DIR_PATH, 'b'),
      TEMP_DIR_PATH,
      DIRNAME,
    ]);

    done();
  });

  it('Valid by index', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('+0');

    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [DIRNAME]);

    done();
  });

  it('Using +1 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('+1');

    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [path.resolve(DIRNAME, TEMP_DIR_PATH)]);

    done();
  });

  it('Using -0 option', (done) => {
    const r = tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('-0');

    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [path.resolve(DIRNAME, TEMP_DIR_PATH)]);

    done();
  });

  it('Using -1 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('-1');

    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [DIRNAME]);

    done();
  });

  it('Using when stack is empty', (done) => {
    assert.throws(() => tl.popd(), { message: 'Failed popd: directory stack empty' });

    done();
  });

  it('Using when the DIRNAME is not stored', (done) => {
    tl.cd(TEMP_DIR_PATH);
    tl.pushd('b');
    const trail = tl.popd();

    assert.ok(trail[0], path.resolve(DIRNAME, TEMP_DIR_PATH));
    assert.ok(process.cwd(), trail[0]);
    assert.throws(() => tl.popd(), { message: 'Failed popd: directory stack empty' });

    done();
  });
});