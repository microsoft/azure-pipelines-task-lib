// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/mocha.d.ts"/>
/// <reference path="../definitions/shelljs.d.ts" />
/// <reference path="../_build/d.ts/vsts-task-lib.d.ts" />

import assert = require('assert');
import path = require('path');
import fs = require('fs');
import util = require('util');
import stream = require('stream');
import shell = require('shelljs');
import os = require('os');
import tl = require('vsts-task-lib/task');
import vm = require('vsts-task-lib/vault');
import tcm = require('vsts-task-lib/taskcommand');
import trm = require('vsts-task-lib/toolrunner');

var _testTemp = path.join(__dirname, '_temp');

var plat = os.platform();

var NullStream = function() {
    stream.Writable.call(this);
    this._write = function(data, encoding, next) {
        next();
    }
}
util.inherits(NullStream, stream.Writable);

var StringStream = function() {
    var contents = '';

    stream.Writable.call(this);
    this._write = function(data, encoding, next) {
        contents += data;
        next();
    }

    this.getContents = function() {
        return contents.toString();
    }
}
util.inherits(StringStream, stream.Writable);

var _nullTestStream = new NullStream();

var _mismatch = function(expected, output) {
    return 'expected' + os.EOL + '"' + expected + '"' + os.EOL + 'returned' + os.EOL + '"' + output + '"';
}

var _buildOutput = function(lines) {
    var output = '';
    lines.forEach(function(line) {
        output += line + os.EOL;
    });

    return output;
}

describe('Test vsts-task-lib', function() {

    before(function(done) {
        try {
            tl.setStdStream(_nullTestStream);
            tl.setErrStream(_nullTestStream);
            tl.setEnvVar('TASKLIB_INPROC_UNITS', '1');

            var success = tl.mkdirP(_testTemp);
            assert(success, 'should have created test temp');
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function() {

    });

    describe('Dir Operations', function() {
        it('creates folder with mkdirP', function(done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'mkdirTest');
            var success = tl.mkdirP(testPath);
            assert(success, 'should created a path');
            assert(shell.test('-d', testPath), 'directory created');

            done();
        });

        it('creates nested folders with mkdirP', function(done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'mkdir1', 'mkdir2');
            var success = tl.mkdirP(testPath);
            assert(success, 'should created a path');
            assert(shell.test('-d', testPath), 'directory created');

            done();
        });

        it('fails if mkdirP with illegal chars', function(done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'mkdir\0');
            var success = tl.mkdirP(testPath);
            assert(!success, 'should have failed');
            assert(!shell.test('-d', testPath), 'directory created');

            done();
        });

        it('fails if mkdirP with null path', function(done) {
            this.timeout(1000);

            var success = tl.mkdirP(null);
            assert(!success, 'should have failed');

            done();
        });

        it('fails if mkdirP with empty path', function(done) {
            this.timeout(1000);

            var success = tl.mkdirP('');
            assert(!success, 'should have failed');

            done();
        });

        it('removes single folder with rmRF', function(done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'testFolder');

            tl.mkdirP(testPath);
            assert(shell.test('-d', testPath), 'directory created');
            assert(shell.test('-e', testPath), 'directory exists');

            var success = tl.rmRF(testPath);
            assert(success, 'should have deleted a single folder');
            assert(!shell.test('-e', testPath), 'directory removed');

            done();
        });

        it('removes recursive folders with rmRF', function(done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'testDir1');
            var testPath2 = path.join(testPath, 'testDir2');
            tl.mkdirP(testPath2);

            assert(shell.test('-d', testPath), '1 directory created');
            assert(shell.test('-d', testPath2), '2 directory created');

            var success = tl.rmRF(testPath);
            assert(success, 'should have removed recursive folders');
            assert(!shell.test('-e', testPath), '1 directory removed');
            assert(!shell.test('-e', testPath2), '2 directory removed');

            done();
        });

        it('removes folder with locked file with rmRF', function(done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'testFolder');
            tl.mkdirP(testPath);
            assert(shell.test('-d', testPath), 'directory created');

            // can't remove folder with locked file on windows
            var filePath = path.join(testPath, 'file.txt');
            fs.appendFileSync(filePath, 'some data');
            assert(shell.test('-e', filePath), 'file exists');

            var fd = fs.openSync(filePath, 'r');
            var success = tl.rmRF(testPath);

            if (plat === 'win32') {
                assert(shell.test('-e', testPath), 'directory still exists');
                assert(!success, 'should not be able to remove folder with locked file');
            }
            else {
                assert(!shell.test('-e', testPath), 'directory removed');
                assert(success, 'should not be able to remove folder with locked file');
            }

            fs.closeSync(fd);
            tl.rmRF(testPath);
            assert(!shell.test('-e', testPath), 'directory removed');

            done();
        });

        it('removes folder that doesnt exist with rmRF', function(done) {
            this.timeout(1000);

            var testFolder = 'testDir';
            var start = __dirname;
            var testPath = path.join(__dirname, testFolder);
            tl.cd(start);
            assert(process.cwd() == start, 'starting in right directory');

            assert(!shell.test('-d', testPath), 'directory created');
            assert(!shell.test('-e', testPath), 'directory exists');

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var success = tl.rmRF(testPath);
            assert(success, 'should have succeeded removing path that does not exist');
            assert(!shell.test('-e', testPath), 'directory still doesnt exist');

            done();
        });

        it('move to non existant destination', function(done) {
            this.timeout(1000);

            var sourceFile = 'sourceFile';
            var destFile = 'destFile';
            var start = __dirname;
            var testPath = path.join(__dirname, sourceFile);
            var destPath = path.join(__dirname, destFile);
            tl.cd(start);
            assert(process.cwd() == start, 'did not start in right directory');

            shell.rm('-f', sourceFile);
            shell.rm('-f', destFile);

            assert(!shell.test('-e', destFile), 'destination file exists');

            fs.writeFileSync(sourceFile, "test move");
            assert(shell.test('-e', sourceFile), 'source file does not exist');

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var success = tl.mv(sourceFile, destFile, false);
            assert(success, 'should have succeeded moving to path that does not exist');
            assert(!shell.test('-e', sourceFile), 'source file still exist');
            assert(shell.test('-e', destFile), 'dest file still does not exist');

            done();
        });

        it('move to existing destination should fail unless forced', function(done) {
            this.timeout(1000);

            var sourceFile = 'sourceFile';
            var destFile = 'destFile';
            var start = __dirname;
            var testPath = path.join(__dirname, sourceFile);
            var destPath = path.join(__dirname, destFile);
            tl.cd(start);
            assert(process.cwd() == start, 'did not start in right directory');

            shell.rm('-f', sourceFile);
            shell.rm('-f', destFile);

            fs.writeFileSync(sourceFile, "test move");
            fs.writeFileSync(destFile, "test move destination");

            assert(shell.test('-e', sourceFile), 'source file does not exist');
            assert(shell.test('-e', destFile), 'destination does not file exists');

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var success = tl.mv(sourceFile, destFile, false);
            assert(!success, 'should not have succeeded moving to path that exists without force option');
            assert(shell.test('-e', sourceFile), 'source file does not exist');
            assert(shell.test('-e', destFile), 'dest file does not exist');

            success = tl.mv(sourceFile, destFile, true);
            assert(success, 'should have succeeded moving to path that exist with force option');
            assert(!shell.test('-e', sourceFile), 'source file should not exist');
            assert(shell.test('-e', destFile), 'dest file does not exist after mv -f');

            done();
        });
    });

    describe('Which on Windows', function() {
        it('which() on windows return file with Extension', function(done) {
            this.timeout(1000);

            if (os.type().match(/^Win/)) {
                var testPath = path.join(_testTemp, 'whichTest');
                tl.mkdirP(testPath);

                fs.writeFileSync(path.join(testPath, 'whichTest'), 'contents');
                fs.writeFileSync(path.join(testPath, 'whichTest.exe'), 'contents');

                if (process.env.path) {
                    process.env.path = process.env.path + ';' + testPath;
                }
                else if (process.env.Path) {
                    process.env.Path = process.env.Path + ';' + testPath;
                }
                else if (process.env.PATH) {
                    process.env.PATH = process.env.PATH + ';' + testPath;
                }

                var whichResult = tl.which('whichTest');
                assert(whichResult.indexOf('.exe') > 0, 'Which() should return file with extension on windows.');
            }
            done();
        });
    });

    describe('TaskInputsVariables', function() {
        it('gets input value', function(done) {
            this.timeout(1000);

            process.env['INPUT_UNITTESTINPUT'] = 'test value';
            tl._loadData();

            var inval = tl.getInput('UnitTestInput', true);
            assert(inval === 'test value', 'reading an input should work');

            done();
        })
        it('should clear input envvar', function(done) {
            this.timeout(1000);

            process.env['INPUT_UNITTESTINPUT'] = 'test value';
            tl._loadData();
            assert(!process.env['INPUT_UNITTESTINPUT'], 'input envvar should be cleared');

            done();
        })
        it('invalid input is null', function(done) {
            this.timeout(1000);

            var inval = tl.getInput('SomeInvalidInput', true);
            assert(!inval, 'a non existant input should return null');

            done();
        })
        it('gets input value with whitespace', function(done) {
            this.timeout(1000);

            process.env['INPUT_UNITTESTINPUT'] = '   test value   ';
            tl._loadData();

            var inval = tl.getInput('UnitTestInput', true);
            assert(inval === 'test value', 'reading an input should work');

            done();
        })
        it('gets a variable', function(done) {
            this.timeout(1000);

            process.env['BUILD_REPOSITORY_NAME'] = 'Test Repository';
            var varVal = tl.getVariable('Build.Repository.Name');
            assert(varVal === 'Test Repository', 'reading a variable should work');

            done();
        })
        it('sets a variable', function(done) {
            this.timeout(1000);

            tl.setVariable('Build.Repository.Uri', 'test value');
            var varVal = process.env['BUILD_REPOSITORY_URI'];
            assert(varVal === 'test value', 'setting a variable should work');

            done();
        })
        it('sets and gets a variable', function(done) {
            this.timeout(1000);

            tl.setVariable('UnitTestVariable', 'test var value');
            var varVal = tl.getVariable('UnitTestVariable');
            assert(varVal === 'test var value', 'variable should match after set and get');

            done();
        })
        it('gets an endpoint url', function(done) {
            this.timeout(1000);


            process.env['ENDPOINT_URL_id1'] = 'http://url';
            tl._loadData();

            var url = tl.getEndpointUrl('id1', true);
            assert(url === 'http://url', 'url should match');

            done();
        })
        it('gets an endpoint auth', function(done) {
            this.timeout(1000);

            process.env['ENDPOINT_AUTH_id1'] = '{ "parameters": {"param1": "val1", "param2": "val2"}, "scheme": "UsernamePassword"}';
            tl._loadData();

            var auth = tl.getEndpointAuthorization('id1', true);
            assert(auth, 'should return an auth obj');
            assert(auth['parameters']['param1'] === 'val1', 'should be correct object');

            done();
        })
        it('gets null if endpoint auth not set', function(done) {
            this.timeout(1000);

            // don't set
            tl._loadData();

            var auth = tl.getEndpointAuthorization('id1', true);
            assert(auth === null, 'should not return an auth obj');

            done();
        })        
        it('should clear auth envvar', function(done) {
            this.timeout(1000);

            process.env['ENDPOINT_AUTH_id1'] = '{ "parameters": {"param1": "val1", "param2": "val2"}, "scheme": "UsernamePassword"}';
            tl._loadData();
            assert(!process.env['ENDPOINT_AUTH_id1'], 'should clear auth envvar');

            done();
        })
        it('gets true bool input value', function(done) {
            this.timeout(1000);

            var inputValue = 'true';
            process.env['INPUT_ABOOL'] = inputValue;
            tl._loadData();

            var outVal = tl.getBoolInput('abool', /*required=*/true);
            assert(outVal, 'should return true');

            done();
        })
        it('gets false bool input value', function(done) {
            this.timeout(1000);

            var inputValue = 'false';
            process.env['INPUT_ABOOL'] = inputValue;
            tl._loadData();

            var outVal = tl.getBoolInput('abool', /*required=*/true);
            assert(!outVal, 'should return false');

            done();
        })
        it('gets path input value', function(done) {
            this.timeout(1000);

            var inputValue = 'test.txt'
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/false);
            assert(path, 'should return a path');
            assert(path === inputValue, 'test path value');

            done();
        })
        it('gets path invalid value required', function(done) {
            this.timeout(1000);

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var path = tl.getPathInput('some_missing_path', /*required=*/true, /*check=*/false);
            assert(!path, 'should not return a path');

            var errMsg = errStream.getContents();
            assert(errMsg.indexOf("Input required:") === 0, "testing err for the required field")

            done();
        })
        it('gets path invalid value not required', function(done) {
            this.timeout(1000);

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var path = tl.getPathInput('some_missing_path', /*required=*/false, /*check=*/false);
            assert(!path, 'should not return a path');

            var errMsg = errStream.getContents();
            assert(errMsg === "", "no err")

            done();
        })
        it('gets path input value with space', function(done) {
            this.timeout(1000);

            var inputValue = 'file name.txt';
            var expectedValue = 'file name.txt';
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/false);
            assert(path, 'should return a path');
            assert(path === expectedValue, 'returned ' + path + ', expected: ' + expectedValue);

            done();
        })
        it('filePathSupplied checks not supplied', function(done) {
            this.timeout(1000);

            var repoRoot = '/repo/root/dir';
            process.env['INPUT_PATH1'] = repoRoot;
            tl._loadData();

            process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
            var supplied = tl.filePathSupplied('path1');
            assert(!supplied, 'path1 should not be supplied');
            done();
        })
        it('filePathSupplied checks supplied', function(done) {
            this.timeout(1000);

            var repoRoot = '/repo/root/dir';
            process.env['INPUT_PATH1'] = repoRoot + '/some/path';
            tl._loadData();

            process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
            var supplied = tl.filePathSupplied('path1');
            assert(supplied, 'path1 should be supplied');
            done();
        })
        it('gets path value with check and exist', function(done) {
            this.timeout(1000);

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var inputValue = __filename;
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/true);
            assert(path, 'should return a path');
            assert(path === inputValue, 'test path value');

            var errMsg = errStream.getContents();
            assert(errMsg === "", "no err")

            done();
        })
        it('gets path value with check and not exist', function(done) {
            this.timeout(1000);

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var inputValue = "someRandomFile.txt";
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/true);
            assert(path, 'should return a path');
            assert(path === inputValue, 'returned ' + path + ', expected ' + inputValue);

            var errMsg = errStream.getContents();
            assert(errMsg.indexOf("Not found") === 0, "testing error path not exist")

            done();
        })
    });

    describe('TaskCommands', function() {
        it('constructs', function(done) {
            this.timeout(1000);

            assert(tcm.TaskCommand, 'TaskCommand should be available');
            var tc = new tcm.TaskCommand('some.cmd', { foo: 'bar' }, 'a message');
            assert(tc, 'TaskCommand constructor works');

            done();
        })
        it('toStrings', function(done) {
            this.timeout(1000);

            var tc = new tcm.TaskCommand('some.cmd', { foo: 'bar' }, 'a message');
            assert(tc, 'TaskCommand constructor works');
            var cmdStr = tc.toString();
            assert(cmdStr === '##vso[some.cmd foo=bar;]a message');
            done();
        })
        it('handles null properties', function(done) {
            this.timeout(1000);

            var tc = new tcm.TaskCommand('some.cmd', null, 'a message');
            assert(tc.toString() === '##vso[some.cmd]a message');
            done();
        })
        it('parses cmd with no properties', function(done) {
            var cmdStr = '##vso[basic.command]messageVal';

            var tc = tcm.commandFromString(cmdStr);

            assert(tc.command === 'basic.command', 'cmd should be correct');
            assert(Object.keys(tc.properties).length == 0, 'should have no properties.');
            assert(tc.message === 'messageVal', 'message is correct');
            done();
        })
        it('parses basic cmd with values', function(done) {
            var cmdStr = '##vso[basic.command prop1=val1;]messageVal';

            var tc = tcm.commandFromString(cmdStr);

            assert(tc.command === 'basic.command', 'cmd should be correct');
            assert(tc.properties['prop1'], 'should be a property names prop1');
            assert(Object.keys(tc.properties).length == 1, 'should have one property.');
            assert(tc.properties['prop1'] === 'val1', 'property value is correct');
            assert(tc.message === 'messageVal', 'message is correct');
            done();
        })
        it('parses basic cmd with multiple properties no trailing semi', function(done) {
            var cmdStr = '##vso[basic.command prop1=val1;prop2=val2]messageVal';

            var tc = tcm.commandFromString(cmdStr);

            assert(tc.command === 'basic.command', 'cmd should be correct');
            assert(tc.properties['prop1'], 'should be a property names prop1');
            assert(Object.keys(tc.properties).length == 2, 'should have one property.');
            assert(tc.properties['prop1'] === 'val1', 'property value is correct');
            assert(tc.properties['prop2'] === 'val2', 'property value is correct');
            assert(tc.message === 'messageVal', 'message is correct');
            done();
        })
        it('parses values with spaces in them', function(done) {
            var cmdStr = '##vso[task.setvariable variable=task variable;]task variable set value';

            var tc = tcm.commandFromString(cmdStr);
            assert(tc.command === 'task.setvariable', 'cmd should be task.setvariable');
            assert(tc.properties['variable'], 'should be a property names variable');
            assert(tc.properties['variable'] === 'task variable', 'property variable is correct');
            assert(tc.message === 'task variable set value');
            done();
        })
        it('handles empty properties', function(done) {
            this.timeout(1000);

            var tc = new tcm.TaskCommand('some.cmd', {}, 'a message');
            assert(tc.toString() === '##vso[some.cmd]a message');
            done();
        })
    });

    describe('TaskLibCommands', function() {
        it('setResult success outputs', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            tl.setResult(tl.TaskResult.Succeeded, 'success msg');

            var expected = _buildOutput(
                ['##vso[task.debug]task result: Succeeded',
                    '##vso[task.complete result=Succeeded;]success msg']);

            var output = stdStream.getContents();

            assert(output === expected, _mismatch(expected, output));

            done();
        })
        it('setResult failed outputs', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            tl.setResult(tl.TaskResult.Failed, 'failed msg');

            var expected = _buildOutput(
                ['##vso[task.debug]task result: Failed',
                    '##vso[task.complete result=Failed;]failed msg']);

            var output = stdStream.getContents();

            assert(output === expected, _mismatch(expected, output));

            done();
        })
        // compat
        it('exit 0 success outputs', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            tl.exit(0);

            var expected = _buildOutput(
                ['##vso[task.debug]task result: Succeeded',
                    '##vso[task.complete result=Succeeded;]Return code: 0']);

            var output = stdStream.getContents();

            assert(output === expected, _mismatch(expected, output));

            done();
        })
        it('exit 1 failed outputs', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            tl.exit(1);

            var expected = _buildOutput(
                ['##vso[task.debug]task result: Failed',
                    '##vso[task.complete result=Failed;]Return code: 1']);

            var output = stdStream.getContents();

            assert(output === expected, _mismatch(expected, output));

            done();
        })
    });

    describe('Vault', function() {
        it('Can create vault', function(done) {
            var vault: vm.Vault = new vm.Vault();

            assert(vault, 'should have created a vault object');

            done();
        })
        it('Can store and retrieve a basic value', function(done) {
            var vault: vm.Vault = new vm.Vault();
            var data = "astring";
            var name = "mystring";
            var stored: boolean = vault.storeSecret(name, data);
            assert(stored, "should have returned stored");

            var ret = vault.retrieveSecret(name);

            assert(data === ret, 'should have retrieved the same string');

            done();
        })
        it('Stores and retrieves using case-insenstive key comparison', function(done) {
            var vault: vm.Vault = new vm.Vault();
            var data = "astring";
            var storageName = "MYstring";
            var retrievalName = "mySTRING";
            var stored: boolean = vault.storeSecret(storageName, data);
            assert(stored, "should have returned stored");

            var ret = vault.retrieveSecret(retrievalName);

            assert(data === ret, 'should have retrieved the same string');

            done();
        })
        it('Returns null when retrieving non-existant item', function(done) {
            var vault: vm.Vault = new vm.Vault();
            var name = "nonexistant";
            var ret = vault.retrieveSecret(name);

            assert(!ret, 'should have returned null for non-existant item');

            done();
        })
        it('Will return false if you store null', function(done) {
            var vault: vm.Vault = new vm.Vault();
            var name = "nullitem";
            var stored: boolean = vault.storeSecret(name, null);
            assert(!stored, "should not have stored a null");

            var ret = vault.retrieveSecret(name);
            assert(!ret, 'should have returned null for non-existant item');

            done();
        })
        it('Will return false if you store empty string', function(done) {
            var vault: vm.Vault = new vm.Vault();
            var name = "nullitem";
            var stored: boolean = vault.storeSecret(name, "");
            assert(!stored, "should not have stored a null");

            var ret = vault.retrieveSecret(name);
            assert(!ret, 'should have returned null for non-existant item');

            done();
        })
    });

    describe('ToolRunner', function() {
        it('ExecSync convenience with stdout', function(done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                var ret = tl.execSync('cmd', '/c echo \'vsts-task-lib\'', _testExecOptions);
                assert(ret.code === 0, 'return code of cmd should be 0');
            }
            else {
                var ret = tl.execSync('ls', '-l -a', _testExecOptions);
                assert(ret.code === 0, 'return code of ls should be 0');
            }

            assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
            tl.popd();
            done();
        })
        it('ExecSync with stdout', function(done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                var cmd = tl.createToolRunner(tl.which('cmd', true));
                cmd.arg('/c echo \'vsts-task-lib\'');

                var ret = cmd.execSync(_testExecOptions);
                assert(ret.code === 0, 'return code of cmd should be 0');
            }
            else {
                var ls = tl.createToolRunner(tl.which('ls', true));
                ls.arg('-l');
                ls.arg('-a');

                var ret = ls.execSync(_testExecOptions);
                assert(ret.code === 0, 'return code of ls should be 0');
            }

            assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
            tl.popd();
            done();
        })
        it('ExecSync fails with rc 1 and stderr', function(done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                var cmd = tl.createToolRunner(tl.which('cmd', true));
                cmd.arg('/c notExist');

                var ret = cmd.execSync(_testExecOptions);
                assert(ret.code === 1, 'return code of cmd should be 1 on failure');
            }
            else {
                var ls = tl.createToolRunner(tl.which('ls', true));
                ls.arg('-j');

                var ret = ls.execSync(_testExecOptions);
                assert(ret.code === 1, 'return code of ls should be 1 on failure');
            }

            assert(ret.stderr && ret.stderr.length > 0, 'should have emitted stderr');
            tl.popd();
            done();
        })
        it('Exec convenience with stdout', function(done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                tl.exec('cmd', '/c echo \'vsts-task-lib\'', _testExecOptions)
                    .then(function(code) {
                        assert(code === 0, 'return code of cmd should be 0');
                    })
                    .fail(function(err) {
                        assert.fail('cmd failed to run: ' + err.message);
                    })
                    .fin(function() {
                        tl.popd();
                        done();
                    })
            }
            else {
                tl.exec('ls', '-l -a', _testExecOptions)
                    .then(function(code) {
                        assert(code === 0, 'return code of ls should be 0');
                    })
                    .fail(function(err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function() {
                        tl.popd();
                        done();
                    })
            }
        })
        it('ToolRunner writes debug', function(done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                var cmdPath = tl.which('cmd', true);
                var cmd = tl.createToolRunner(cmdPath);
                cmd.arg('/c echo \'vsts-task-lib\'');

                cmd.exec(_testExecOptions)
                    .then(function(code) {
                        var contents = stdStream.getContents();
                        assert(contents.indexOf('exec tool: ' + cmdPath) >= 0, 'should exec cmd');
                        assert(code === 0, 'return code of cmd should be 0');
                    })
                    .fail(function(err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function() {
                        tl.popd();
                        done();
                    })
            }
            else {
                var ls = tl.createToolRunner(tl.which('ls', true));
                ls.arg('-l');
                ls.arg('-a');

                ls.exec(_testExecOptions)
                    .then(function(code) {
                        var contents = stdStream.getContents();
                        assert(contents.indexOf('exec tool: /bin/ls') >= 0, 'should exec ls');
                        assert(code === 0, 'return code of ls should be 0');
                    })
                    .fail(function(err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function() {
                        tl.popd();
                        done();
                    })
            }
        })
        it('Execs with stdout', function(done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            var output = '';
            if (plat === 'win32') {
                var cmd = tl.createToolRunner(tl.which('cmd', true));
                cmd.arg('/c  echo \'vsts-task-lib\'');

                cmd.on('stdout', (data) => {
                    output = data.toString();
                });

                cmd.exec(_testExecOptions)
                    .then(function(code) {
                        assert(code === 0, 'return code of cmd should be 0');
                        assert(output && output.length > 0, 'should have emitted stdout');
                    })
                    .fail(function(err) {
                        assert.fail('cmd failed to run: ' + err.message);
                    })
                    .fin(function() {
                        tl.popd();
                        done();
                    })
            }
            else {
                var ls = tl.createToolRunner(tl.which('ls', true));
                ls.arg('-l');
                ls.arg('-a');

                ls.on('stdout', (data) => {
                    output = data.toString();
                });

                ls.exec(_testExecOptions)
                    .then(function(code) {
                        assert(code === 0, 'return code of ls should be 0');
                        assert(output && output.length > 0, 'should have emitted stdout');
                    })
                    .fail(function(err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function() {
                        tl.popd();
                        done();
                    })
            }
        })
        it('Fails on return code 1 with stderr', function(done) {
            this.timeout(1000);

            var failed = false;

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            var output = '';
            if (plat === 'win32') {
                var cmd = tl.createToolRunner(tl.which('cmd', true));
                cmd.arg('/c notExist');

                cmd.on('stderr', (data) => {
                    output = data.toString();
                });

                cmd.exec(_testExecOptions)
                    .then(function(code) {
                        assert(code === 1, 'return code of cmd should be 1');
                        assert(output && output.length > 0, 'should have emitted stderr');
                    })
                    .fail(function(err) {
                        failed = true;
                    })
                    .fin(function() {
                        if (!failed) {
                            done(new Error('cmd should have failed'));
                            return;
                        }

                        done();
                    })
            }
            else {
                var ls = tl.createToolRunner(tl.which('ls', true));
                ls.arg('-j');

                ls.on('stderr', (data) => {
                    output = data.toString();
                });

                ls.exec(_testExecOptions)
                    .then(function(code) {
                        assert(code === 1, 'return code of ls -j should be 1');
                        assert(output && output.length > 0, 'should have emitted stderr');
                    })
                    .fail(function(err) {
                        failed = true;
                    })
                    .fin(function() {
                        if (!failed) {
                            done(new Error('ls should have failed'));
                            return;
                        }

                        done();
                    })
            }
        })
        it('Succeeds on stderr by default', function(done) {
            this.timeout(1000);

            var scriptPath = path.join(__dirname, 'scripts', 'stderroutput.js');
            var ls = tl.createToolRunner(tl.which('node', true));
            ls.arg(scriptPath);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }
            ls.exec(_testExecOptions)
                .then(function(code) {
                    assert(code === 0, 'should have succeeded on stderr');
                    done();
                })
                .fail(function(err) {
                    done(new Error('did not succeed on stderr'))
                })
        })
        it('Fails on stderr if specified', function(done) {
            this.timeout(1000);

            var failed = false;

            var scriptPath = path.join(__dirname, 'scripts', 'stderrOutput.js');
            var ls = tl.createToolRunner(tl.which('node', true));
            ls.arg(scriptPath);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: true,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }
            ls.exec(_testExecOptions)
                .then(function(code) {
                    assert(code === 0, 'should have succeeded on stderr');
                })
                .fail(function(err) {
                    failed = true;
                })
                .fin(function() {
                    if (!failed) {
                        done(new Error('should have failed on stderr'));
                        return;
                    }

                    done();
                })
        })
        it('handles single args', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.arg('one');
            node.arg('two');
            assert(node.args.length === 2, 'should have 2 args');
            assert(node.args.toString() === 'one,two', 'should be one,two');
            done();
        })
        it('handles padded spaces', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.arg(' one ');
            node.arg('two');
            assert(node.args.length === 2, 'should have 2 args');
            console.log(node.args.toString());
            assert(node.args.toString() === 'one,two', 'should be one,two');
            done();
        })        
        it('handles basic arg string with spaces', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.argString('one two');
            node.arg('three');
            assert(node.args.length === 3, 'should have 3 args');
            assert(node.args.toString() === 'one,two,three', 'should be one,two,three');
            done();
        })
        it('handles arg string with extra spaces', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.argString('one   two');
            node.arg('three');
            assert(node.args.length === 3, 'should have 3 args');
            assert(node.args.toString() === 'one,two,three', 'should be one,two,three');
            done();
        })        
        it('handles equals and switches', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.argString('foo=bar -x');
            node.arg('-y');
            assert(node.args.length === 3, 'should have 3 args');
            assert(node.args.toString() === 'foo=bar,-x,-y', 'should be foo=bar,-x,-y');
            done();
        })
        it('handles double quotes', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.argString('foo="bar baz" -x');
            node.arg('-y');
            assert(node.args.length === 3, 'should have 3 args');
            assert(node.args.toString() === 'foo=bar baz,-x,-y', 'should be foo=bar baz,-x,-y');
            done();
        })
        it('handles quote in double quotes', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.argString('foo="bar \\" baz" -x');
            node.arg('-y');
            assert(node.args.length === 3, 'should have 3 args');
            assert(node.args.toString() === 'foo=bar " baz,-x,-y', 'should be foo=bar " baz,-x,-y');
            done();
        })        
        it('handles literal path', function(done) {
            this.timeout(1000);

            var node = tl.createToolRunner(tl.which('node', true));
            node.pathArg('/bin/working folder1');
            node.arg('/bin/working folder2');
            assert(node.args.length === 2, 'should have 2 args');
            assert(node.args.toString() === '/bin/working folder1,/bin/working folder2', 'should be /bin/working folder1 /bin/working folder2');
            done();
        })
    });

    describe('Localization', function() {
        it('validate loc string key in lib.json', function(done) {
            this.timeout(1000);

            var jsonPath = path.join(__dirname, '../lib.json');
            var json = require(jsonPath);
            if (json && json.hasOwnProperty('messages')) {
                for (var key in json.messages) {
                    assert(key.search(/\W+/gi) < 0, ('messages key: \'' + key + '\' contain non-word characters, only allows [a-zA-Z0-9_].'));
                    assert(key.search(/^LIB_/) === 0, ('messages key: \'' + key + '\' should start with \'LIB_\'.'));
                    if (typeof (json.messages[key]) === 'object') {
                        assert(false, ('messages key: \'' + key + '\' should have a loc string, not a object.'));
                    }
                    else if (typeof (json.messages[key]) === 'string') {
                        assert(json.messages[key].toString().length > 0, ('messages key: \'' + key + '\' should have a loc string.'));
                    }
                }
            }

            done();
        })
        it('get loc string from loc resources.json', function(done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            var tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'zh-CN');
            shell.mkdir('-p', tempLocFolder);
            var locJsonStr = "{\"loc.messages.key1\" : \"loc cn-string for key 1.\", \"loc.messages.key2\" : \"loc cn-string for key %d.\", \"loc.messages.key3\" : \"loc cn-string for key %%.\"}";
            var locJsonPath = path.join(tempLocFolder, 'resources.resjson');
            fs.writeFileSync(locJsonPath, locJsonStr);

            process.env['SYSTEM_CULTURE'] = 'ZH-cn'; // Lib should handle casing differences for culture.

            tl.setResourcePath(jsonPath);

            assert(tl.loc('key1') === 'loc cn-string for key 1.', 'string not found for key.');
            assert(tl.loc('key2', 2) === 'loc cn-string for key 2.', 'string not found for key.');
            assert(tl.loc('key3') === 'loc cn-string for key %%.', 'string not found for key.');

            done();
        })
        it('fallback to current string if culture resources.resjson not found', function(done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            process.env['SYSTEM_CULTURE'] = 'zh-CN';

            tl.setResourcePath(jsonPath);
            assert(tl.loc('key2', 2) === 'string for key 2.', 'en-US fallback string not return for key.');

            done();
        })
        it('fallback to current string if loc string not found in culture resources.resjson', function(done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            var tempLocFolder = path.join(tempFolder, 'strings', 'resources.resjson', 'zh-CN');
            shell.mkdir('-p', tempLocFolder);
            var locJsonStr = "{\"loc.messages.key1\" : \"loc cn-string for key 1.\", \"loc.messages.key3\" : \"loc cn-string for key %%.\"}";
            var locJsonPath = path.join(tempLocFolder, 'resources.resjson');
            fs.writeFileSync(locJsonPath, locJsonStr);

            process.env['SYSTEM_CULTURE'] = 'zh-CN';

            tl.setResourcePath(jsonPath);
            assert(tl.loc('key2', 2) === 'string for key 2.', 'en-US fallback string not return for key.');

            done();
        })
        it('fallback to en-US if culture not set', function(done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            var tempLocFolder = path.join(tempFolder, 'strings', 'resources.resjson', 'en-US');
            shell.mkdir('-p', tempLocFolder);
            var locJsonStr = "{\"loc.messages.key1\" : \"loc en-string for key 1.\", \"loc.messages.key2\" : \"loc en-string for key %d.\", \"loc.messages.key3\" : \"loc en-string for key %%.\"}";
            var locJsonPath = path.join(tempLocFolder, 'resources.resjson');
            fs.writeFileSync(locJsonPath, locJsonStr);

            process.env['SYSTEM_CULTURE'] = '';

            tl.setResourcePath(jsonPath);
            assert(tl.loc('key2', 2) === 'loc en-string for key 2.', 'en-US fallback string not return for key.');

            done();
        })
        it('return key and params if key is not in task.json', function(done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\"}}";
            var jsonPath = path.join(tempFolder + 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            tl.setResourcePath(jsonPath);
            assert(tl.loc('key3', 3) === 'key3 3', 'key and params not return for non-exist key.');

            done();
        })

        it('publish code coverage passes all the properties properly', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish("Jacoco", "\\user\\admin\\summary.xml", "\\user\\admin\\report", "\\user\\admin\\report\\t.xml,\\user\\admin\\report\\c.xml");

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.publish codecoveragetool=Jacoco;summaryfile=\\user\\admin\\summary.xml;reportdirectory=\\user\\admin\\report;additionalcodecoveragefiles=\\user\\admin\\report\\t.xml,\\user\\admin\\report\\c.xml;]"]);
            assert(expectedOutput === output, _mismatch(expectedOutput, output));
            done();
        })

        it('publish code coverage does not pass properties when the imput parameters are empty', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish("", "", "", "");

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.publish]"]);
            assert(expectedOutput === output, _mismatch(expectedOutput, output));
            done();
        })

        it('publish code coverage does not pass properties when the input parameters are null', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish(null, null, null, null);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.publish]"]);
            assert(expectedOutput === output, _mismatch(expectedOutput, output));
            done();
        })

        it('enable code coverage does not pass properties when the input parameters are null', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccEnabler = new tl.CodeCoverageEnabler(null, null);
            var buildProps: { [key: string]: string } = {};
            ccEnabler.enableCodeCoverage(buildProps);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.enable ]"]);
            assert(expectedOutput === output, _mismatch(expectedOutput, output));
            done();
        })

        it('enable code coverage passes properties when the input parameters are existing', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccEnabler = new tl.CodeCoverageEnabler("jacoco", "buildtool");
            var buildProps: { [key: string]: string } = {};
            buildProps['abc'] = 'xyz';
            ccEnabler.enableCodeCoverage(buildProps);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.enable abc=xyz;buildtool=jacoco;codecoveragetool=buildtool;]"]);
            assert(expectedOutput === output, _mismatch(expectedOutput, output));
            done();
        })

        it('enable code coverage passes parameters when the input parameters are empty', function(done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccEnabler = new tl.CodeCoverageEnabler("jacoco", "buildtool");
            var buildProps: { [key: string]: string } = {};
            ccEnabler.enableCodeCoverage(buildProps);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.enable buildtool=jacoco;codecoveragetool=buildtool;]"]);
            assert(expectedOutput === output, _mismatch(expectedOutput, output));
            done();
        })
    });
});
