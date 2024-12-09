import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert');

import * as tl from '../_build/task';

const ROOT_DIR = path.resolve();

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

  tl.cd(ROOT_DIR);
}

describe('popd cases', () => {
  const TEMP_DIR_PATH = path.resolve('test_pushd', 'nested', 'dummy', 'dir');

  before(() => {
    fs.mkdirSync(path.resolve(ROOT_DIR, TEMP_DIR_PATH, 'a'), { recursive: true });
    fs.mkdirSync(path.resolve(ROOT_DIR, TEMP_DIR_PATH, 'b', 'c'), { recursive: true });
  });

  beforeEach(() => {
    reset();
  });


  after(() => {
    reset();
    fs.rmSync(path.resolve(ROOT_DIR, TEMP_DIR_PATH), { recursive: true });
  });

  it('The default usage', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd();
    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [ROOT_DIR]);
    done();
  });

  it('Using two directories on the stack', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    const trail = tl.popd();
    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, TEMP_DIR_PATH),
      ROOT_DIR,
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
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, TEMP_DIR_PATH),
      ROOT_DIR,
    ]);
    done();
  });

  it('Valid by index', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('+0');
    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [ROOT_DIR]);
    done();
  });

  it('Using +1 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('+1');
    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [path.resolve(ROOT_DIR, TEMP_DIR_PATH)]);
    done();
  });

  it('Using -0 option', (done) => {
    const r = tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('-0');
    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [path.resolve(ROOT_DIR, TEMP_DIR_PATH)]);
    done();
  });

  it('Using -1 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.popd('-1');
    assert.ok(process.cwd(), trail[0]);
    assert.deepEqual(trail, [ROOT_DIR]);
    done();
  });

  it('Using when stack is empty', (done) => {
    assert.throws(() => tl.popd(), { message: 'Failed popd: directory stack empty' });
    done();
  });

  it('Using when the ROOT_DIR is not stored', (done) => {
    tl.cd(TEMP_DIR_PATH);
    tl.pushd('b');
    const trail = tl.popd();
    assert.ok(trail[0], path.resolve(ROOT_DIR, TEMP_DIR_PATH));
    assert.ok(process.cwd(), trail[0]);
    assert.throws(() => tl.popd(), { message: 'Failed popd: directory stack empty' });
    done();
  });
});