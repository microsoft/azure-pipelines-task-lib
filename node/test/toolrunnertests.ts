// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import path = require('path');
import os = require('os');
import * as tl from '../_build/task';
import * as trm from '../_build/toolrunner';

import testutil = require('./testutil');

describe('Toolrunner Tests', function () {

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


    it('ExecSync convenience with stdout', function (done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        if (os.platform() === 'win32') {
            var ret = tl.execSync('cmd', '/c echo \'vsts-task-lib\'', _testExecOptions);
            assert.equal(ret.code, 0, 'return code of cmd should be 0');
        }
        else {
            var ret = tl.execSync('ls', '-l -a', _testExecOptions);
            assert.equal(ret.code, 0, 'return code of ls should be 0');
        }

        assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
        tl.popd();
        done();
    })
    it('ExecSync with stdout', function (done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        if (os.platform() === 'win32') {
            var cmd = tl.tool(tl.which('cmd', true));
            cmd.arg('/c echo \'vsts-task-lib\'');

            var ret = cmd.execSync(_testExecOptions);
            assert.equal(ret.code, 0, 'return code of cmd should be 0');
        }
        else {
            var ls = tl.tool(tl.which('ls', true));
            ls.arg('-l');
            ls.arg('-a');

            var ret = ls.execSync(_testExecOptions);
            assert.equal(ret.code, 0, 'return code of ls should be 0');
        }

        assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
        tl.popd();
        done();
    })
    it('ExecSync fails with rc 1 and stderr', function (done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var tool;
        if (os.platform() === 'win32') {
            tool = tl.tool(tl.which('cmd', true));
            tool.arg('/c');
            tool.arg('echo hello from stderr 1>&2 && exit 123');
        }
        else {
            tool = tl.tool(tl.which('bash', true));
            tool.arg('-c');
            tool.arg('echo hello from stderr 1>&2 ; exit 123');
        }

        var ret = tool.execSync(_testExecOptions);
        assert.equal(ret.code, 123, 'return code of tool should be 1');
        assert.equal(ret.stderr.toString().trim(), 'hello from stderr');
        tl.popd();
        done();
    })
    it('Exec convenience with stdout', function (done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        if (os.platform() === 'win32') {
            tl.exec('cmd', '/c echo \'vsts-task-lib\'', _testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of cmd should be 0');
                })
                .fail(function (err) {
                    assert.fail('cmd failed to run: ' + err.message);
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
        else {
            tl.exec('ls', '-l -a', _testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of ls should be 0');
                })
                .fail(function (err) {
                    assert.fail('ls failed to run: ' + err.message);
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
    })
    it('ToolRunner writes debug', function (done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        if (os.platform() === 'win32') {
            var cmdPath = tl.which('cmd', true);
            var cmd = tl.tool(cmdPath);
            cmd.arg('/c echo \'vsts-task-lib\'');

            cmd.exec(_testExecOptions)
                .then(function (code) {
                    var contents = stdStream.getContents();
                    assert(contents.indexOf('exec tool: ' + cmdPath) >= 0, 'should exec cmd');
                    assert.equal(code, 0, 'return code of cmd should be 0');
                })
                .fail(function (err) {
                    assert.fail('ls failed to run: ' + err.message);
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
        else {
            var ls = tl.tool(tl.which('ls', true));
            ls.arg('-l');
            ls.arg('-a');

            ls.exec(_testExecOptions)
                .then(function (code) {
                    var contents = stdStream.getContents();
                    assert(contents.indexOf('exec tool: /bin/ls') >= 0, 'should exec ls');
                    assert.equal(code, 0, 'return code of ls should be 0');
                })
                .fail(function (err) {
                    assert.fail('ls failed to run: ' + err.message);
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
    })
    it('Execs with stdout', function (done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var output = '';
        if (os.platform() === 'win32') {
            var cmd = tl.tool(tl.which('cmd', true));
            cmd.arg('/c  echo \'vsts-task-lib\'');

            cmd.on('stdout', (data) => {
                output = data.toString();
            });

            cmd.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of cmd should be 0');
                    assert(output && output.length > 0, 'should have emitted stdout');
                })
                .fail(function (err) {
                    assert.fail('cmd failed to run: ' + err.message);
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
        else {
            var ls = tl.tool(tl.which('ls', true));
            ls.arg('-l');
            ls.arg('-a');

            ls.on('stdout', (data) => {
                output = data.toString();
            });

            ls.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of ls should be 0');
                    assert(output && output.length > 0, 'should have emitted stdout');
                })
                .fail(function (err) {
                    assert.fail('ls failed to run: ' + err.message);
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
    })
    it('Fails on return code 1 with stderr', function (done) {
        this.timeout(1000);

        var failed = false;

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var output = '';
        if (os.platform() === 'win32') {
            var cmd = tl.tool(tl.which('cmd', true));
            cmd.arg('/c notExist');

            cmd.on('stderr', (data) => {
                output = data.toString();
            });

            cmd.exec(_testExecOptions)
                .then(function (code) {
                    assert(code === 1, 'return code of cmd should be 1');
                    assert(output && output.length > 0, 'should have emitted stderr');
                })
                .fail(function (err) {
                    failed = true;
                })
                .fin(function () {
                    if (!failed) {
                        done(new Error('cmd should have failed'));
                        return;
                    }

                    done();
                })
        }
        else {
            var ls = tl.tool(tl.which('ls', true));
            ls.arg('-j');

            ls.on('stderr', (data) => {
                output = data.toString();
            });

            ls.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 1, 'return code of ls -j should be 1');
                    assert(output && output.length > 0, 'should have emitted stderr');
                })
                .fail(function (err) {
                    failed = true;
                })
                .fin(function () {
                    if (!failed) {
                        done(new Error('ls should have failed'));
                        return;
                    }

                    done();
                })
        }
    })
    it('Succeeds on stderr by default', function (done) {
        this.timeout(1000);

        var scriptPath = path.join(__dirname, 'scripts', 'stderroutput.js');
        var ls = tl.tool(tl.which('node', true));
        ls.arg(scriptPath);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }
        ls.exec(_testExecOptions)
            .then(function (code) {
                assert.equal(code, 0, 'should have succeeded on stderr');
                done();
            })
            .fail(function (err) {
                done(new Error('did not succeed on stderr'))
            })
    })
    it('Fails on stderr if specified', function (done) {
        this.timeout(1000);

        var failed = false;

        var scriptPath = path.join(__dirname, 'scripts', 'stderrOutput.js');
        var ls = tl.tool(tl.which('node', true));
        ls.arg(scriptPath);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: true,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }
        ls.exec(_testExecOptions)
            .then(function (code) {
                assert.equal(code, 0, 'should have succeeded on stderr');
            })
            .fail(function (err) {
                failed = true;
            })
            .fin(function () {
                if (!failed) {
                    done(new Error('should have failed on stderr'));
                    return;
                }

                done();
            })
    })
    it('Exec pipe to another tool, succeeds if both tools succeed', function(done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var output = '';
        if (os.platform() === 'win32') {
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('ssh');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('ax');
            ps.pipeExecOutputToTool(grep);

            ps.on('stdout', (data) => {
                output += data.toString();
            });

            ps.exec(_testExecOptions)
            .then(function (code) {
                assert.equal(code, 0, 'return code of exec should be 0');
                assert(output && output.length > 0 && output.indexOf('ssh') >= 0, 'should have emitted stdout ' + output);
            })
            .fail(function (err) {
                assert.fail('ps ax | grep ssh failed to run: ' + err.message);
            })
            .fin(function () {
                tl.popd();
                done();
            })
        }
    })
    it('Exec pipe to another tool, fails if first tool fails', function(done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var output = '';
        var errOut = '';
        if (os.platform() === 'win32') {
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('ssh');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('bad');
            ps.pipeExecOutputToTool(grep);

            ps.on('stdout', (data) => {
                output += data.toString();
            });

            ps.on('stderr', (data) => {
                errOut += data.toString();
            })

            ps.exec(_testExecOptions)
                .then(function (code) {
                    assert.fail('ps bad | grep ssh was a bad command and it did not fail');
                })
                .fail(function (err) {
                    assert(errOut && errOut.length > 0 && errOut.indexOf('ps: illegal option') >= 0, 'error output from ps command is expected');
                    assert(err && err.message && err.message.indexOf('/bin/ps') >=0, 'error from ps is not reported');
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
    })
    it('Exec pipe to another tool, fails if second tool fails', function(done) {
        this.timeout(1000);

        tl.pushd(__dirname);

        var _testExecOptions: trm.IExecOptions = {
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var output = '';
        var errOut = '';
        if (os.platform() === 'win32') {
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('--?');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('ax');
            ps.pipeExecOutputToTool(grep);

            ps.on('stdout', (data) => {
                output += data.toString();
            });

            ps.on('stderr', (data) => {
                errOut += data.toString();
            })

            ps.exec(_testExecOptions)
                .then(function (code) {
                    assert.fail('ps ax | grep --? was a bad command and it did not fail');
                })
                .fail(function (err) {
                    assert(errOut && errOut.length > 0 && errOut.indexOf('grep: unrecognized option') >= 0, 'error output from ps command is expected');
                    assert(err && err.message && err.message.indexOf('/user/bin/grep') >=0, 'error from grep is not reported');
                })
                .fin(function () {
                    tl.popd();
                    done();
                })
        }
    })
    it('handles single args', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.arg('one');
        node.arg('two');
        assert.equal(node.args.length, 2, 'should have 2 args');
        assert.equal(node.args.toString(), 'one,two', 'should be one,two');
        done();
    })
    it('handles arg chaining', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.arg('one').arg('two').argIf(true, 'three').line('four five');
        //node.arg('one').arg('two').argIf(true, 'three');
        assert.equal(node.args.length, 5, 'should have 5 args');
        assert.equal(node.args.toString(), 'one,two,three,four,five', 'should be one,two,three,four,five');
        done();
    })        
    it('handles padded spaces', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.arg(' one ');
        node.arg('two');
        assert.equal(node.args.length, 2, 'should have 2 args');
        assert.equal(node.args.toString(), 'one,two', 'should be one,two');
        done();
    })
    it('handles basic arg string with spaces', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.line('one two');
        node.arg('three');
        assert.equal(node.args.length, 3, 'should have 3 args');
        assert.equal(node.args.toString(), 'one,two,three', 'should be one,two,three');
        done();
    })
    it('handles arg string with extra spaces', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.line('one   two');
        node.arg('three');
        assert.equal(node.args.length, 3, 'should have 3 args');
        assert.equal(node.args.toString(), 'one,two,three', 'should be one,two,three');
        done();
    })
    it('handles arg string with backslash', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.line('one two\\arg');
        node.arg('three');
        assert.equal(node.args.length, 3, 'should have 3 args');
        assert.equal(node.args.toString(), 'one,two\\arg,three', 'should be one,two,three');
        done();
    })
    it('handles equals and switches', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.line('foo=bar -x');
        node.arg('-y');
        assert.equal(node.args.length, 3, 'should have 3 args');
        assert.equal(node.args.toString(), 'foo=bar,-x,-y', 'should be foo=bar,-x,-y');
        done();
    })
    it('handles double quotes', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.line('foo="bar baz" -x');
        node.arg('-y');
        assert.equal(node.args.length, 3, 'should have 3 args');
        assert.equal(node.args.toString(), 'foo=bar baz,-x,-y', 'should be foo=bar baz,-x,-y');
        done();
    })
    it('handles quote in double quotes', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.line('foo="bar \\" baz" -x');
        node.arg('-y');
        assert.equal(node.args.length, 3, 'should have 3 args');
        assert.equal(node.args.toString(), 'foo=bar " baz,-x,-y', 'should be foo=bar " baz,-x,-y');
        done();
    })
    it('handles literal path', function (done) {
        this.timeout(1000);

        var node = tl.tool(tl.which('node', true));
        node.arg('--path').arg('/bin/working folder1');
        assert.equal(node.args.length, 2, 'should have 2 args');
        assert.equal(node.args.toString(), '--path,/bin/working folder1', 'should be --path /bin/working folder1');
        done();
    })
});
