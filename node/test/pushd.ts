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

describe('pushd cases', () => {
  const TEMP_DIR_PATH = path.resolve(DIRNAME, 'test_pushd', 'nested', 'dir');

  before(() => {
    fs.mkdirSync(path.resolve(TEMP_DIR_PATH, 'a'), { recursive: true });
    fs.mkdirSync(path.resolve(TEMP_DIR_PATH, 'b', 'c'), { recursive: true });
  });

  beforeEach(() => {
    reset();
  });

  after(() => {
    reset();
    fs.rmSync(path.resolve(TEMP_DIR_PATH), { recursive: true });
  });

  it('Push valid directories', (done) => {
    const trail = tl.pushd(TEMP_DIR_PATH);
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      TEMP_DIR_PATH,
      DIRNAME,
    ]);
    done();
  });

  it('Using two directories', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    const trail = tl.pushd('a');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
    ]);
    done();
  });

  it('Using three directories', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd('a');
    const trail = tl.pushd('../b');
    assert.equal(process.cwd(), trail[0]);
    assert.deepEqual(trail, [
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
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
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
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
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
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
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
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
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
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
      TEMP_DIR_PATH,
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
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
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
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
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
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
      TEMP_DIR_PATH,
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
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
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
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
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
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
      path.resolve(TEMP_DIR_PATH, 'b', 'c'),
      path.resolve(TEMP_DIR_PATH, 'b'),
      path.resolve(TEMP_DIR_PATH, 'a'),
      TEMP_DIR_PATH,
      DIRNAME,
    ]);
    done();
  });

  it('Using invalid directory', (done) => {
    const oldCwd = process.cwd();
    assert.throws(() => tl.pushd('does/not/exist'), { message: /^Failed pushd: no such file or directory:/ });
    assert.equal(process.cwd(), oldCwd);
    done();
  });

  it('Using without args swaps top two directories when stack length is 2', (done) => {
    let trail = tl.pushd(TEMP_DIR_PATH);
    assert.equal(trail.length, 2);
    assert.equal(trail[0], TEMP_DIR_PATH);
    assert.equal(trail[1], DIRNAME);
    assert.equal(process.cwd(), trail[0]);
    trail = tl.pushd();
    assert.equal(trail.length, 2);
    assert.equal(trail[0], DIRNAME);
    assert.equal(trail[1], TEMP_DIR_PATH);
    assert.equal(process.cwd(), trail[0]);
    done();
  });

  it('Using without args swaps top two directories for larger stacks', (done) => {
    tl.pushd(TEMP_DIR_PATH);
    tl.pushd();
    const trail = tl.pushd(path.join(TEMP_DIR_PATH, 'a'));
    assert.equal(trail.length, 3);
    assert.equal(trail[0], path.join(TEMP_DIR_PATH, 'a'));
    assert.equal(trail[1], DIRNAME);
    assert.equal(trail[2], TEMP_DIR_PATH);
    assert.equal(process.cwd(), trail[0]);
    done();
  });

  it('Using without arguments invalid when stack is empty', (done) => {
    assert.throws(() => tl.pushd(), { message: 'Failed pushd: no other directory' });
    done();
  });
});