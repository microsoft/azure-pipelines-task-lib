/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Telemetry Tests', function () {

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

    it('publish telemetry if the agent version is greater than 2.120', function (done) {
        this.timeout(1000);

        let originalAgentVersion = process.env['AGENT_VERSION'];
        process.env['AGENT_VERSION'] = '2.120.0';

        try {
            let data = { 'abc': 'xyz' };
            var stdStream = testutil.createStringStream();
            tl.setStdStream(stdStream);
            tl.publishTelemetry('test', 'testf', data);

            var output = stdStream.getContents();
            var expectedOutput = testutil.buildOutput(["##vso[telemetry.publish area=test;feature=testf;]" + JSON.stringify(data)]);
            assert.ok(output.indexOf(expectedOutput) >= 0, 'telemetry command should be published');
        } finally {
            process.env['AGENT_VERSION'] = originalAgentVersion;
        }

        done();
    });

    it('publish telemetry the agent version is less than 2.120', function (done) {
        this.timeout(1000);

        let originalAgentVersion = process.env['AGENT_VERSION'];
        process.env['AGENT_VERSION'] = '2.119.0';

        try {
            let data = { 'abc': 'xyz' };
            var stdStream = testutil.createStringStream();
            tl.setStdStream(stdStream);
            tl.publishTelemetry('test', 'testf', data);

            var output = stdStream.getContents();
            assert.ok(output.indexOf('##vso[telemetry.publish') == -1, 'telemetry command shouldnt be called');
        } finally {
            process.env['AGENT_VERSION'] = originalAgentVersion;
        }

        done();
    });
});