// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Filter Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        done();
    });

    it('applies default option nobrace true', (done) => {
        this.timeout(1000);

        const list = [
            '/brace-test/brace_{hello,world}.txt',
            '/brace-test/brace_hello.txt',
            '/brace-test/brace_world.txt',
        ];
        const pattern = '/brace-test/brace_{hello,world}.txt';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected: string[] = [
            '/brace-test/brace_{hello,world}.txt'
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option noglobstar false', (done) => {
        this.timeout(1000);

        const list = [
            '/glob-star-test/hello/world/hello-world.txt',
            '/glob-star-test/hello/hello.txt',
            '/glob-star-test/glob-star-test.txt',
        ];
        const pattern = '/glob-star-test/**';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected = [
            '/glob-star-test/hello/world/hello-world.txt',
            '/glob-star-test/hello/hello.txt',
            '/glob-star-test/glob-star-test.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option dot true', (done) => {
        this.timeout(1000);

        const list = [
            '/dot-test/.hello/.world.txt',
            '/dot-test/.hello/other.zzz',
        ];
        const pattern = '/dot-test/*/*.txt';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected = [
            '/dot-test/.hello/.world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option noext false', (done) => {
        this.timeout(1000);

        const list = [
            '/ext-glob-test/@(hello|world).txt',
            '/ext-glob-test/hello.txt',
            '/ext-glob-test/world.txt',
        ];
        const pattern = '/ext-glob-test/@(hello|world).txt';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected = [
            '/ext-glob-test/hello.txt',
            '/ext-glob-test/world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option nocase based on platform', (done) => {
        this.timeout(1000);

        const list = [
            '/case-test/hello.txt',
            '/case-test/world.TXT',
        ];
        const pattern = '/case-test/*.txt';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected: string[] = [];
        expected.push('/case-test/hello.txt');
        if (process.platform == 'win32') {
            expected.push('/case-test/world.TXT');
        }

        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option matchBase false', (done) => {
        this.timeout(1000);

        const list = [
            '/match-base-test/match-base-file.txt',
            'match-base-file.txt',
        ];
        const pattern = 'match-base-file.txt';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected = [
            'match-base-file.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option nocomment false', (done) => {
        this.timeout(1000);

        const list = [
            '#comment-test',
        ];
        const pattern = '#comment-test';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected: string[] = [];
        assert.deepEqual(actual, expected);

        done();
    });

    it('applies default option nonegate false', (done) => {
        this.timeout(1000);

        const list = [
            '/negate-test/hello.txt',
            '/negate-test/world.txt',
        ];
        const pattern = '!/negate-test/hello.txt';
        const actual: string[] = list.filter(tl.filter(pattern));
        const expected = [
            '/negate-test/world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('supports custom options', (done) => {
        this.timeout(1000);

        const list = [
            '/brace-test/brace_{hello,world}.txt',
            '/brace-test/brace_hello.txt',
            '/brace-test/brace_world.txt',
        ];
        const pattern = '/brace-test/brace_{hello,world}.txt';
        const actual: string[] = list.filter(tl.filter(pattern, <tl.MatchOptions>{ nobrace: false }));
        const expected = [
            '/brace-test/brace_hello.txt',
            '/brace-test/brace_world.txt',
        ];
        assert.deepEqual(actual, expected);

        done();
    });
});
