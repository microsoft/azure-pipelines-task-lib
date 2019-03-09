// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import * as mt from '../_build/mock-task';
import * as mtm from '../_build/mock-test';
import * as mtr from '../_build/mock-toolrunner';
import * as ma from '../_build/mock-answer';
import * as tl from '../_build/task';

import os = require('os');
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

    it('match not mocked', (done) => {
        let actual: string[] = (mt as any).match(
            [
                '/foo',
                '/bar',
                '/baz',
            ],
            '/ba[rz]');
        assert.deepEqual(actual, [ '/bar', '/baz' ]);

        done();
    })

    it('filter not mocked', (done) => {
        let list = [
            '/foo',
            '/bar',
            '/baz',
        ];
        let actual: string[] = list.filter((mt as any).filter('/ba[rz]'));
        assert.deepEqual(actual, [ '/bar', '/baz' ]);

        done();
    })

    it('Mocks findMatch results', (done) => {
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "findMatch": {
                "/ba[rz]": [
                    "/bar",
                    "/baz",
                ]
            }
        };

        mt.setAnswers(a);
        var matches: string[] = mt.findMatch('/default-root', '/ba[rz]');
        assert.deepEqual(matches, [ '/bar', '/baz' ]);

        done();
    })

    it('Mock loc returns key', (done: MochaDone) => {
        let actual = mt.loc('STR_KEY');
        assert.equal(actual, 'loc_mock_STR_KEY');
        done();
    })

    it('Mock loc returns key and args', (done: MochaDone) => {
        let actual = mt.loc('STR_KEY', false, 2, 'three');
        assert.equal(actual, 'loc_mock_STR_KEY false 2 three');
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
    
    it('Mock toolRunner returns correct output', async () => {
        const expectedStdout = "atool output here" + os.EOL + "abc";
        const expectedStderr = "atool with this stderr output" + os.EOL + "def";
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exec": {
                "/usr/local/bin/atool --arg foo": {
                    "code": 0,
                    "stdout": expectedStdout,
                    "stderr": expectedStderr
                }
            }
        };

        mt.setAnswers(a);

        let tool: mtr.ToolRunner = mt.tool('/usr/local/bin/atool');
        tool.arg('--arg');
        tool.arg('foo');

        let firstStdline = true;
        let firstErrline = true;
        let numStdLineCalls = 0;
        let numStdErrCalls = 0;
        tool.on('stdout', (out) => {
            assert.equal(expectedStdout, out);
        });
        tool.on('stderr', (out) => {
            assert.equal(expectedStderr, out);
        });
        tool.on('stdline', (out) => {
            numStdLineCalls += 1;
            if (firstStdline) {
                assert.equal("atool output here", out);
                firstStdline = false;
            }
            else {
                assert.equal("abc", out);
            }
        });
        tool.on('errline', (out) => {
            numStdErrCalls += 1;
            if (firstErrline) {
                assert.equal("atool with this stderr output", out);
                firstErrline = false;
            }
            else {
                assert.equal("def", out);
            }
        });
        await tool.exec(<mtr.IExecOptions>{});
        
        assert.equal(numStdLineCalls, 2);
        assert.equal(numStdErrCalls, 2);
    })
    
    it('Mock toolRunner returns correct output when ending on EOL', async () => {
        const expectedStdout = os.EOL;
        const expectedStderr = os.EOL;
        var a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "exec": {
                "/usr/local/bin/atool --arg foo": {
                    "code": 0,
                    "stdout": expectedStdout,
                    "stderr": expectedStderr
                }
            }
        };

        mt.setAnswers(a);

        let tool: mtr.ToolRunner = mt.tool('/usr/local/bin/atool');
        tool.arg('--arg');
        tool.arg('foo');
        let numStdLineCalls = 0;
        let numStdErrCalls = 0;
        tool.on('stdout', (out) => {
            assert.equal(expectedStdout, out);
        });
        tool.on('stderr', (out) => {
            assert.equal(expectedStderr, out);
        });
        tool.on('stdline', (out) => {
            numStdLineCalls += 1;
            assert.equal("", out);
        });
        tool.on('errline', (out) => {
            numStdErrCalls += 1;
            assert.equal("", out);
        });
        await tool.exec(<mtr.IExecOptions>{});
        
        assert.equal(numStdLineCalls, 1);
        assert.equal(numStdErrCalls, 1);
    })
});
