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

describe('pushd cases', () => {
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

  it('Push valid directories', (done) => {
    const trail = tl.pushd(TEMP_DIR_PATH);
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
    ]);
    done();
  });

  it('Using two directories', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.pushd('a');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/'),
      ROOT_DIR,
    ]);
    done();
  });

  it('Using three directories', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    const trail = tl.pushd('../b');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
    ]);
    done();
  });

  it('Using four directories', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    const trail = tl.pushd('c');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
    ]);
    done();
  });

  it('Using push stuff around with positive indices', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('+0');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
    ]);
    done();
  });

  it('Using +1 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('+1');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
    ]);
    done();
  });

  it('Using +2 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('+2');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
    ]);
    done();
  });

  it('Using +3 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('+3');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
    ]);
    done();
  });

  it('Using +4 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('+4');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
    ]);
    done();
  });

  it('Using negative index', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('-0');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
    ]);
    done();
  });

  it('Using -1 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('-1');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
    ]);
    done();
  });

  it('Using -2 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('-2');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
    ]);
    done();
  });

  it('Using -3 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('-3');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
    ]);
    done();
  });

  it('Using -4 option', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    tl.pushd('../b');
    tl.pushd('c');
    const trail = tl.pushd('-4');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b/c'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/b'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir/a'),
      path.resolve(ROOT_DIR, 'test_pushd/nested/dummy/dir'),
      ROOT_DIR,
    ]);
    done();
  });

  it('Using invalid directory', (done) => {
    const oldCwd = process.cwd();
    assert.throws(() => tl.pushd('does/not/exist'), { message: `Failed pushd: no such file or directory: ${path.resolve('.', 'does/not/exist').replace(/\\/g, '/')}` });
    assert.equal(process.cwd(), oldCwd);
    done();
  });

  it('Using without args swaps top two directories when stack length is 2', (done) => {
    let trail = tl.pushd(TEMP_DIR_PATH);
    assert.equal(trail.length, 2);
    assert.equal(path.relative(ROOT_DIR, trail[0]), path.join('test_pushd/nested/dummy/dir'));
    assert.equal(trail[1], ROOT_DIR);
    assert.equal(process.cwd(), trail[0]);
    trail = tl.pushd();
    assert.equal(trail.length, 2);
    assert.equal(trail[0], ROOT_DIR);
    assert.equal(path.relative(ROOT_DIR, trail[1]), path.join('test_pushd/nested/dummy/dir'));
    assert.equal(process.cwd(), trail[0]);
    done();
  });

  it('Using without args swaps top two directories for larger stacks', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd();
    const trail = tl.pushd('test_pushd/nested/dummy/dir/a');
    assert.equal(trail.length, 3);
    assert.equal(path.relative(ROOT_DIR, trail[0]), path.join('test_pushd/nested/dummy/dir', 'a'));
    assert.equal(trail[1], ROOT_DIR);
    assert.equal(path.relative(ROOT_DIR, trail[2]), path.join('test_pushd/nested/dummy/dir'));
    assert.equal(process.cwd(), trail[0]);
    done();
  });

  it('Using without arguments invalid when stack is empty', (done) => {
    assert.throws(() => tl.pushd(), { message: 'Failed pushd: no other directory' });
    done();
  });
});