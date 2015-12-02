// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/mocha.d.ts"/>
/// <reference path="../definitions/node.d.ts"/>

import assert = require('assert');
import path = require('path');
import fs = require('fs');
import util = require('util');
import stream = require('stream');
var shell = require('shelljs');
var os = require('os');

var tl;

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

describe('Test vso-task-lib', function() {

	before(function(done) {
		try
		{
			tl = require('..');
			tl.setStdStream(_nullTestStream);
			tl.setErrStream(_nullTestStream);
			tl.setEnvVar('TASKLIB_INPROC_UNITS', '1');
		}
		catch (err) {
			assert.fail('Failed to load task lib: ' + err.message);
		}
		done();
	});

	after(function() {

	});

	describe('Dir Operations', function() {
		it('mkdirs', function(done) {
			this.timeout(1000);

			var testFolder = 'testDir';
			var start = __dirname;
			var testPath = path.join(__dirname, testFolder);
			tl.cd(start);
			assert(process.cwd() == start, 'starting in right directory');
			tl.mkdirP(testPath);
			assert(shell.test('-d', testPath), 'directory created');
			tl.pushd(testFolder);
			assert(process.cwd() == testPath, 'cwd is created directory');
			tl.popd(testFolder);

			done();
		});
		
		it('rmRF single folder', function(done) {
			this.timeout(1000);

			var testFolder = 'testDir';
			var start = __dirname;
			var testPath = path.join(__dirname, testFolder);
			tl.cd(start);
			assert(process.cwd() == start, 'starting in right directory');
			
			// remove empty folder
			tl.mkdirP(testPath);
			assert(shell.test('-d', testPath), 'directory created');
			assert(shell.test('-e', testPath), 'directory exists');
			
			tl.rmRF(testPath);
			assert(!shell.test('-e', testPath), 'directory removed');

			done();
		});
		
		it('rmRF recursive folders', function(done) {
			this.timeout(1000);

			var testFolder = 'testDir';
			var start = __dirname;
			var testPath = path.join(__dirname, testFolder);
			tl.cd(start);
			assert(process.cwd() == start, 'starting in right directory');
			
			// remove nonempty folder
			var testFolder2 = 'testDir2';
			var testPath2 = path.join(testPath, testFolder2);
			tl.mkdirP(testPath2);
			
			assert(shell.test('-d', testPath), 'directory created');
			assert(shell.test('-e', testPath), 'directory exists');
			assert(shell.test('-d', testPath2), 'directory created');
			assert(shell.test('-e', testPath2), 'directory exists');
			
			tl.rmRF(testPath);
			assert(!shell.test('-e', testPath), 'directory removed');
			assert(!shell.test('-e', testPath2), 'directory removed');
			
			done();
		});
		
		it('rmRF folder with locked file', function(done) {
			this.timeout(1000);
			
			var testFolder = 'testDir';
			var start = __dirname;
			var testPath = path.join(__dirname, testFolder);
			tl.cd(start);
			assert(process.cwd() == start, 'starting in right directory');
			
			// can't remove folder with locked file
			var filePath = path.join(testPath, 'file.txt');
			tl.mkdirP(testPath);
			fs.appendFileSync(filePath, 'some data');
					
			assert(shell.test('-d', testPath), 'directory created');
			assert(shell.test('-e', filePath), 'file exists');
			
			var errStream = new StringStream();
			tl.setErrStream(errStream);
			
			var fd = fs.openSync(filePath, 'r');
			tl.rmRF(testPath);
			assert(shell.test('-e', testPath), 'directory still exists');
			
			var err = errStream.getContents();
			assert(err.indexOf("return code: 1") === 0, "correct error for trying to remove locked file")
			
			fs.closeSync(fd);
			tl.rmRF(testPath);
			assert(!shell.test('-e', testPath), 'directory removed');
			
			done();
		});
		
		it('rmRF folder that doesnt exist', function(done) {
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
			
			tl.rmRF(testPath);
			assert(!shell.test('-e', testPath), 'directory still doesnt exist');
			
			var err = errStream.getContents();
			assert(err.indexOf("return code: 1") != 0, "removing nonexistant folder should succeed")

			done();
		});
	});

	describe('TaskInputsVariables', function() {
		it('gets input value', function(done) {
			this.timeout(1000);
			
			process.env['INPUT_UNITTESTINPUT'] = 'test value';
			var inval = tl.getInput('UnitTestInput', true);
			assert(inval === 'test value', 'reading an input should work');

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
			var inval = tl.getInput('UnitTestInput', true);
			assert(inval === 'test value', 'reading an input should work');

			done();
		})
		it('gets a variable', function (done) {
			this.timeout(1000);

			process.env['BUILD_REPOSITORY_NAME'] = 'Test Repository';
			var varVal = tl.getVariable('Build.Repository.Name');
			assert(varVal === 'Test Repository', 'reading a variable should work');

			done();
		})
		it('sets a variable', function (done) {
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
			var url = tl.getEndpointUrl('id1');
			assert(url === 'http://url', 'url should match');

			done();
		})
		it('gets an endpoint auth', function(done) {
			this.timeout(1000);
			
			process.env['ENDPOINT_AUTH_id1'] = '{ "param1": "val1", "param2": "val2"}';
			var auth = tl.getEndpointAuthorization('id1');
			assert(auth, 'should return an auth obj');
			assert(auth.param1 === 'val1', 'should be correct object');

			done();
		})
		it('gets true bool input value', function(done) {
			this.timeout(1000);

			var inputValue = 'true';
			process.env['INPUT_ABOOL'] = inputValue;
			var outVal = tl.getBoolInput('abool', /*required=*/true);
			assert(outVal, 'should return true');

			done();
		})
		it('gets false bool input value', function(done) {
			this.timeout(1000);

			var inputValue = 'false';
			process.env['INPUT_ABOOL'] = inputValue;
			var outVal = tl.getBoolInput('abool', /*required=*/true);
			assert(!outVal, 'should return false');

			done();
		})		
		it('gets path input value', function(done) {
			this.timeout(1000);

			var inputValue = 'test.txt'
			process.env['INPUT_PATH1'] = inputValue;
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
			var expectedValue = '"file name.txt"';
			process.env['INPUT_PATH1'] = inputValue;
			var path = tl.getPathInput('path1', /*required=*/true, /*check=*/false);
			assert(path, 'should return a path');
			assert(path === expectedValue, 'returned ' + path + ', expected: ' + expectedValue);

			done();
		})
        it('filePathSupplied checks not supplied', function (done) {
            this.timeout(1000);
            var repoRoot = '/repo/root/dir';
            process.env['INPUT_PATH1'] = repoRoot;
            process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
            var supplied = tl.filePathSupplied('path1');
            assert(!supplied, 'path1 should not be supplied');
            done();
        })
        it('filePathSupplied checks supplied', function (done) {
            this.timeout(1000);
            var repoRoot = '/repo/root/dir';
            process.env['INPUT_PATH1'] = repoRoot + '/some/path';
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
			var path = tl.getPathInput('path1', /*required=*/true, /*check=*/true);
			assert(path, 'should return a path');
			assert(path === inputValue, 'returned ' + path +', expected ' + inputValue);

			var errMsg = errStream.getContents();
			assert(errMsg.indexOf("not found") === 0, "testing error path not exist")

			done();
		})
	});

	describe('TaskCommands', function() {
		it('constructs', function(done) {
			this.timeout(1000);

			assert(tl.TaskCommand, 'TaskCommand should be available');
			var tc = new tl.TaskCommand('some.cmd', {foo: 'bar'}, 'a message');
			assert(tc, 'TaskCommand constructor works');

			done();
		})
		it('toStrings', function(done) {
			this.timeout(1000);

			var tc = new tl.TaskCommand('some.cmd', {foo: 'bar'}, 'a message');
			assert(tc, 'TaskCommand constructor works');
			var cmdStr = tc.toString();
			assert(cmdStr === '##vso[some.cmd foo=bar;]a message');
			done();
		})
		it('handles null properties', function(done) {
			this.timeout(1000);

			var tc = new tl.TaskCommand('some.cmd', null, 'a message');
			assert(tc.toString() === '##vso[some.cmd]a message');
			done();
		})
		it('parses cmd with no properties', function(done) {
			var cmdStr = '##vso[basic.command]messageVal';

			var tc = tl.commandFromString(cmdStr);

			assert(tc.command === 'basic.command', 'cmd should be correct');
			assert(Object.keys(tc.properties).length == 0, 'should have no properties.');
			assert(tc.message === 'messageVal', 'message is correct');
			done();
		})		
		it('parses basic cmd with values', function(done) {
			var cmdStr = '##vso[basic.command prop1=val1;]messageVal';

			var tc = tl.commandFromString(cmdStr);

			assert(tc.command === 'basic.command', 'cmd should be correct');
			assert(tc.properties['prop1'], 'should be a property names prop1');
			assert(Object.keys(tc.properties).length == 1, 'should have one property.');
			assert(tc.properties['prop1'] === 'val1', 'property value is correct');
			assert(tc.message === 'messageVal', 'message is correct');
			done();
		})
		it('parses basic cmd with multiple properties no trailing semi', function(done) {
			var cmdStr = '##vso[basic.command prop1=val1;prop2=val2]messageVal';

			var tc = tl.commandFromString(cmdStr);

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

			var tc = tl.commandFromString(cmdStr);
			assert(tc.command === 'task.setvariable', 'cmd should be task.setvariable');
			assert(tc.properties['variable'], 'should be a property names variable');
			assert(tc.properties['variable'] === 'task variable', 'property variable is correct');
			assert(tc.message === 'task variable set value');
			done();
		})
		it('handles empty properties', function(done) {
			this.timeout(1000);

			var tc = new tl.TaskCommand('some.cmd', {}, 'a message');
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
				 '##vso[task.complete result=Succeeded;]return code: 0']);

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
				 '##vso[task.complete result=Failed;]return code: 1']);

			var output = stdStream.getContents();

			assert(output === expected, _mismatch(expected, output));

			done();
		})			
	});

	describe('ToolRunner', function() {	
		it('execSync convenience with stdout', function(done) {
			this.timeout(1000);

			tl.pushd(__dirname);

			var ret = tl.execSync('ls', '-l -a', {outStream:_nullTestStream, errStream:_nullTestStream});
			assert(ret.code === 0, 'return code of ls should be 0');
			assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
			tl.popd();
			done();
		})		
		it('ExecSync with stdout', function(done) {
			this.timeout(1000);

			tl.pushd(__dirname);

			var ls = new tl.ToolRunner(tl.which('ls', true));
			ls.arg('-l');
			ls.arg('-a');

			var ret = ls.execSync({outStream:_nullTestStream, errStream:_nullTestStream});
			assert(ret.code === 0, 'return code of ls should be 0');
			assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
			tl.popd();
			done();
		})	
		it('ExecSync fails with rc 1 and stderr', function(done) {
			this.timeout(1000);

			tl.pushd(__dirname);

			var ls = new tl.ToolRunner(tl.which('ls', true));
			ls.arg('-j');

			var ret = ls.execSync({outStream:_nullTestStream, errStream:_nullTestStream});
			assert(ret.code === 1, 'return code of ls should be 1 on failure');
			assert(ret.stderr && ret.stderr.length > 0, 'should have emitted stderr');
			tl.popd();
			done();
		})
		it('Exec convenience with stdout', function(done) {
			this.timeout(1000);

			tl.pushd(__dirname);

			tl.exec('ls', '-l -a', {outStream:_nullTestStream, errStream:_nullTestStream})
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
		})
		it('ToolRunner writes debug', function(done) {
			this.timeout(1000);

			tl.pushd(__dirname);

			var ls = new tl.createToolRunner(tl.which('ls', true));
			ls.arg('-l');
			ls.arg('-a');

			var stdStream = new StringStream();
			tl.setStdStream(stdStream);
			ls.exec({outStream:_nullTestStream, errStream:_nullTestStream})
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
		})		
		it('Execs with stdout', function(done) {
			this.timeout(1000);

			tl.pushd(__dirname);

			var ls = new tl.ToolRunner(tl.which('ls', true));
			ls.arg('-l');
			ls.arg('-a');

			var output = '';
			ls.on('stdout', (data) => {
				output = data.toString();
			});

			ls.exec({outStream:_nullTestStream, errStream:_nullTestStream})
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
		})
		it ('Fails on return code 1 with stderr', function(done) {
			this.timeout(1000);

			var failed = false;

			var ls = new tl.ToolRunner(tl.which('ls', true));
			ls.arg('-j');

			var output = '';
			ls.on('stderr', (data) => {
				output = data.toString();
			});

			ls.exec({outStream:_nullTestStream, errStream:_nullTestStream})
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
		})
		it ('Succeeds on stderr by default', function(done) {
			this.timeout(1000);

			var scriptPath = path.join(__dirname, 'scripts', 'stderroutput.js');
			var ls = new tl.ToolRunner(tl.which('node', true));
			ls.arg(scriptPath);

			ls.exec({outStream:_nullTestStream, errStream:_nullTestStream})
				.then(function(code) {
					assert(code === 0, 'should have succeeded on stderr');
					done();
				})
				.fail(function(err) {
					done(new Error('did not succeed on stderr'))
				})
		})
		it ('Fails on stderr if specified', function(done) {
			this.timeout(1000);

			var failed = false;

			var scriptPath = path.join(__dirname, 'scripts', 'stderrOutput.js');
			var ls = new tl.ToolRunner(tl.which('node', true));
			ls.arg(scriptPath);

			ls.exec({failOnStdErr: true, outStream:_nullTestStream, errStream:_nullTestStream})
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
		it ('handles single args', function(done) {
			this.timeout(1000);

			var node = new tl.ToolRunner(tl.which('node', true));
			node.arg('one');
			node.arg('two');
			assert(node.args.length === 2, 'should have 2 args');
			assert(node.args.toString() === 'one,two', 'should be one,two');
			done();
		})
		it ('handles basic arg line with spaces', function(done) {
			this.timeout(1000);

			var node = new tl.ToolRunner(tl.which('node', true));
			node.arg('one two');
			node.arg('three');
			assert(node.args.length === 3, 'should have 3 args');
			assert(node.args.toString() === 'one,two,three', 'should be one,two,three');
			done();
		})
		it ('handles equals and switches', function(done) {
			this.timeout(1000);

			var node = new tl.ToolRunner(tl.which('node', true));
			node.arg('foo=bar -x');
			node.arg('-y');
			assert(node.args.length === 3, 'should have 3 args');
			assert(node.args.toString() === 'foo=bar,-x,-y', 'should be foo=bar,-x,-y');
			done();
		})
		it ('handles double quotes', function(done) {
			this.timeout(1000);

			var node = new tl.ToolRunner(tl.which('node', true));
			node.arg('foo="bar baz" -x');
			node.arg('-y');
			assert(node.args.length === 3, 'should have 3 args');
			assert(node.args.toString() === 'foo=bar baz,-x,-y', 'should be foo=bar baz,-x,-y');
			done();
		})
	});	

});
