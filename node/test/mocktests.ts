// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import mockery = require('mockery');
import * as mt from '../_build/mock-task';
import * as mtm from '../_build/mock-test';
import * as mtr from '../_build/mock-toolrunner';
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

    it('Mock returns toolRunner', (done) => {
        let tool = mt.tool('atool');
        assert(tool, "tool should not be null");

        done();
    })

    it('Mock toolRunner returns success code', async () => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exec": {
                "/usr/local/bin/atool --arg foo": {
                    "code": 0,
                    "stdout": "atool output here",
                    "stderr": "atool with this stderr output"
                }
            }
        };

        mt.setAnswers(a);

        let tool: mtr.ToolRunner = mt.tool('/usr/local/bin/atool');
        tool.arg('--arg');
        tool.arg('foo');
        let rc: number = await tool.exec(<mtr.IExecOptions>{});
        
        assert(tool, "tool should not be null");
        assert(rc == 0, "rc is 0");
    })
    it('MockTestRunner passes arguments to executed scripts', async() => {
        var calledArgs: string[];
        try {
            // Fake out the 'child_process' module so we can trap the call to spawnSync
            mockery.enable({ useCleanCache: true, warnOnUnregistered: false });
            mockery.registerMock('child_process', {
                spawnSync: (nodePath, args) => {
                    calledArgs = args;
                    return { pid: 123, output: [], stdout: "", stderr: "", status: 0 };
                }
            });

            var scriptName = "foo.js";
            var arg1 = "bar";
            var arg2 = "car";
            var mtmLocal = require('../_build/mock-test'); // get the mock-test module again (from mockery) 
            var mtr = new mtmLocal.MockTestRunner(scriptName);

            mtr.run(arg1, arg2);

            assert.equal(calledArgs.length, 3, "additional args should be passed to the script");
            assert.equal(calledArgs[0], scriptName, `expected '${scriptName}' to be passed to node. Got '${calledArgs[0]}'`);
            assert.equal(calledArgs[1], arg1, `expected '${arg1}' to be passed to the script. Got '${calledArgs[1]}'`);
            assert.equal(calledArgs[2], arg2, `expected '${arg2}' to be passed to the script. Got '${calledArgs[2]}'`);
        }
        finally {
            mockery.deregisterMock('child_process');
            mockery.disable();
        }
    })
});
