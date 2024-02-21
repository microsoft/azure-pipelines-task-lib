// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as testutil from './testutil';
import * as tl from '../_build/task';
import { IssueSource, _loadData } from '../_build/internal';


describe('Task Issue command test without token', function () {

    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        done();
    });

    after(function (done) {
        done();
    });

    it('adds issue sources for task.issue messages', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error", IssueSource.CustomerScript)
        tl.warning("Test warning", IssueSource.TaskInternal)

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=CustomerScript;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for task.issue command', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error");
        tl.warning("Test warning");

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=TaskInternal;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for the setResult', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Failed, 'failed msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Failed',
             '##vso[task.issue type=error;source=TaskInternal;]failed msg',
             '##vso[task.complete result=Failed;]failed msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
});

describe('Task Issue command test with token', function () {

    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        process.env['TASK_SDK_COMMAND_TOKEN'] = 'test_token123';
        _loadData();
        done();
    });

    after(function (done) {
        delete process.env['TASK_SDK_COMMAND_TOKEN'];
        _loadData();
        done();
    });

    it('removes the token from env var', function (done) {
        this.timeout(1000);

        assert.equal(process.env['TASK_SDK_COMMAND_TOKEN'], undefined);

        done();
    })

    it('doesn\'t provide the token using task variables', function (done) {
        this.timeout(1000);

        process.env['AGENT_VERSION'] = '2.115.0'
        let variable = tl.getVariable('TASK_SDK_COMMAND_TOKEN');
        let taskVariable = tl.getTaskVariable('TASK_SDK_COMMAND_TOKEN');
        assert.equal(variable, undefined);
        assert.equal(taskVariable, undefined);
        
        done();
    })

    it('adds the token for task.issue messages', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error", IssueSource.CustomerScript)
        tl.warning("Test warning", IssueSource.TaskInternal)

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=CustomerScript;token=test_token123;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;token=test_token123;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for task.issue command', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error");
        tl.warning("Test warning");

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=TaskInternal;token=test_token123;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;token=test_token123;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for the setResult', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Failed, 'failed msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Failed',
             '##vso[task.issue type=error;source=TaskInternal;token=test_token123;]failed msg',
             '##vso[task.complete result=Failed;]failed msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
});