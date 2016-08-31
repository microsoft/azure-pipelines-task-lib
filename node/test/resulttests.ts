// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
// import child = require('child_process');
// import path = require('path');
// import fs = require('fs');
// import util = require('util');
// import stream = require('stream');
// import shell = require('shelljs');
// import os = require('os');

import * as tl from '../_build/task';
// import * as vm from '../_build/vault';
// import * as tcm from '../_build/taskcommand';
// import * as trm from '../_build/toolrunner';

import testutil = require('./testutil');

describe('Result Tests', function () {

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

    it('setResult success outputs', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Succeeded, 'success msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Succeeded',
                '##vso[task.complete result=Succeeded;]success msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
    it('setResult failed outputs', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Failed, 'failed msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Failed',
                '##vso[task.issue type=error;]failed msg',
                '##vso[task.complete result=Failed;]failed msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
    it('setResult failed does not create issue with empty message', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Failed, '');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Failed',
                '##vso[task.complete result=Failed;]']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
});
