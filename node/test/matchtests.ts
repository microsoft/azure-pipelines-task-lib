// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Match Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });

    it('single pattern', (done: MochaDone) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj2/readme.txt'
        ];
        let pattern: string = '/projects/**/*.proj';
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, pattern, options);
        assert.equal(result.length, 2);
        assert.equal(result[0], '/projects/myproj1/myproj1.proj');
        assert.equal(result[1], '/projects/myproj2/myproj2.proj');

        done();
    });

    it('aggregates matches', (done: MochaDone) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj3/myproj3.proj'
        ];
        let patterns: string[] = [
            '/projects/**/myproj1.proj',
            '/projects/**/myproj2.proj'
        ];
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, patterns, options);
        assert.equal(result.length, 2);
        assert.equal(result[0], '/projects/myproj1/myproj1.proj');
        assert.equal(result[1], '/projects/myproj2/myproj2.proj');

        done();
    });

    it('does not duplicate matches', (done: MochaDone) => {
        this.timeout(1000);

        let list: string[] = [
            '/included/file1.proj',
            '/included/file2.proj',
            '/not_included/readme.txt'
        ];
        let patterns: string[] = [
            '/included/**', // both patterns match the same files
            '/**/*.proj'
        ];
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, patterns, options);
        assert.equal(result.length, 2);
        assert.equal(result[0], '/included/file1.proj');
        assert.equal(result[1], '/included/file2.proj');

        done();
    });

    it('preserves order', (done: MochaDone) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj3/myproj3.proj',
            '/projects/myproj4/myproj4.proj',
            '/projects/myproj5/myproj5.proj'
        ];
        let patterns: string[] = [
            '/projects/**/myproj2.proj', // mix up the order
            '/projects/**/myproj5.proj',
            '/projects/**/myproj3.proj',
            '/projects/**/myproj1.proj',
            '/projects/**/myproj4.proj',
        ];
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, patterns, options);
        assert.equal(result.length, 5);
        assert.equal(result[0], '/projects/myproj1/myproj1.proj'); // should follow original list order
        assert.equal(result[1], '/projects/myproj2/myproj2.proj');
        assert.equal(result[2], '/projects/myproj3/myproj3.proj');
        assert.equal(result[3], '/projects/myproj4/myproj4.proj');
        assert.equal(result[4], '/projects/myproj5/myproj5.proj');

        done();
    });

    it('exclude pattern', (done: MochaDone) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj2/readme.txt'
        ];
        let pattern: string[] = ['/projects/**/*.proj','!**/myproj2.proj'];
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, pattern, options);
        assert.equal(result.length, 1);
        assert.equal(result[0], '/projects/myproj1/myproj1.proj');

        done();
    });

    it('exclude pattern with multiple excludes', (done: MochaDone) => {
        this.timeout(1000);

        let list: string[] = [
            '/projects/myproj1/myproj1.proj',
            '/projects/myproj1/myproj1.txt',
            '/projects/myproj2/myproj2.proj',
            '/projects/myproj2/myproj2.txt',
            '/projects/myproj3/myproj3.proj',
            '/projects/myproj3/myproj3.txt',
            '/projects/myproj4/myproj4.proj',
            '/projects/myproj4/myproj4.txt',
        ];
        let patterns: string[] = [
            '**/myproj*.proj', // mix up the order
            '!**/*.txt'
        ];
        let options: tl.MatchOptions = { matchBase: true };
        let result: string[] = tl.match(list, patterns, options);
        assert.equal(result.length, 4);
        // should follow original list order
        assert.equal(result[0], '/projects/myproj1/myproj1.proj'); 
        assert.equal(result[1], '/projects/myproj2/myproj2.proj');
        assert.equal(result[2], '/projects/myproj3/myproj3.proj');
        assert.equal(result[3], '/projects/myproj4/myproj4.proj');

        done();
    });
});
