// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import * as mt from '../_build/mock-task';
import * as ma from '../_build/mock-answer';
import * as tl from '../_build/task';

import testutil = require('./testutil');

describe('Mock Tests', function () {

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

    it('Mocks which and returns path on exists', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "foo": "/bar/baz"
            }
        };

        mt.setAnswers(a);
        assert.equal(mt.which('foo'), '/bar/baz');

        done();
    })
    it('Mock which and returns null on not exist', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "foo": "/bar/baz"
            }
        };

        mt.setAnswers(a);
        assert.equal(mt.which('foo2'), null);

        done();
    })
    it('Mocks exist and returns true on exists', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exist": {
                "/foo/bar": true
            }
        };

        mt.setAnswers(a);
        assert(mt.exist('/foo/bar'));

        done();
    })
    it('Mocks exist and returns false on not exists', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exist": {
                "/foo/bar": true
            }
        };

        mt.setAnswers(a);
        assert.equal(mt.exist('/foo/bar2'), false);

        done();
    })
    it('Mocks CheckPath with Success', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "checkPath": {
                "/foo/bar": true
            }
        };

        mt.setAnswers(a);
        mt.checkPath('/foo/bar', 'bar');

        done();
    })
    it('Mock CheckPath Throws', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "checkPath": {
                "/foo/bar": false
            }
        };

        mt.setAnswers(a);
        assert.throws(() => { mt.checkPath('/foo/bar', 'bar')});

        done();
    })

    it('Mocks matches item in list', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "match": {
                "**/TEST-*.xml": [
                    "/user/build/fun/test-123.xml"
                ]
            }
        };

        mt.setAnswers(a);
        var matches: string[] = mt.match([], "**/TEST-*.xml", {});
        assert.equal(matches.length, 1);
        assert.equal(matches[0], "/user/build/fun/test-123.xml");

        done();
    })        
});
