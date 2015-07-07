var Q = require('q');
var shell = require('shelljs');
var fs = require('fs');
var path = require('path');
var os = require('os');
var minimatch = require('minimatch');
var tcm = require('./taskcommand');
var trm = require('./toolrunner');

//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------
var _outStream = process.stdout;
var _errStream = process.stderr;

function _writeError(str) {
    _errStream.write(str + os.EOL);
}

function _writeLine(str) {
    _outStream.write(str + os.EOL);
}

export function setStdStream(stdStream) {
    _outStream = stdStream;
}

export function setErrStream(errStream) {
    _errStream = errStream;
}

export function exit(code) {
    debug('task exit: ' + code);
    shell.exit(code);
}

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
export function getVariable(name) {
    var varval = process.env[name.replace('.', '_').toUpperCase()];
    debug(name + '=' + varval);
    return varval;
}

export function getInput(name, required) {
	var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        _writeError('Input required: ' + name);
        exit(1);
    }

    debug(name + '=' + inval);
    return inval;    
}

export function getDelimitedInput(name, delim, required) {
    var inval = getInput(name, required);
    if (!inval) {
        return [];
    }    
    return inval.split(delim);
}

export function getPathInput(name, required, check) {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        _writeError('Input required: ' + name);
        exit(1);
    }

    if (check) {
        checkPath(inval, name);
    }

    debug(name + '=' + inval);
    return inval;
}

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
export function writeCommand(command, properties, message) {
    var taskCmd = new tcm.TaskCommand(command, properties, message);
    _writeLine(taskCmd.toString());
}

export function warning(message) {
    writeCommand('task.issue', {'type': 'warning'}, message);
}

export function error(message) {
    writeCommand('task.issue', {'type': 'error'}, message);
}

export function debug(message) {
    writeCommand('task.debug', null, message);
}

var _argStringToArray = function(argString) {
    var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);

    for (var i = 0; i < args.length; i++) {
        args[i] = args[i].replace(/"/g, "");
    }
    return args;
}

export function cd(path) {
    shell.cd(path);
}

export function pushd(path) {
    shell.pushd(path);
}

export function popd() {
    shell.popd();
}

//------------------------------------------------
// Validation Helpers
//------------------------------------------------
export function checkPath(p, name) {
    debug('check path : ' + p);
    if (!p || !fs.existsSync(p)) {
        console.error('invalid ' + name + ': ' + p);
        exit(1);
    }    
}

//-----------------------------------------------------
// Shell/File I/O Helpers
// Abstract these away so we can
// - default to good error handling
// - inject system.debug info
// - have option to switch internal impl (shelljs now)
//-----------------------------------------------------
export function mkdirP(p) {
    if (!shell.test('-d', p)) {
        debug('creating path: ' + p);
        shell.mkdir('-p', p);
        if (shell.error()) {
            console.error(shell.error())
            exit(1);
        }
    }
    else {
        debug('path exists: ' + p);
    }
}

export function which(tool, check) {
    var toolPath = shell.which(tool);
    if (check) {
        checkPath(toolPath, tool);
    }

    debug(tool + '=' + toolPath);
    return toolPath;
}

export function cp(options, source, dest) {
    shell.cp(options, source, dest);
}

export function find(findPath) {
    var matches = shell.find(findPath);
    debug('find ' + findPath);
    debug(matches.length + ' matches.');
    return matches;
}

export function rmRF(path) {
    debug('rm -rf ' + path);
    shell.rm('-rf', path);
}

//-----------------------------------------------------
// Test Publisher
//-----------------------------------------------------
export class TestPublisher {
    constructor(testRunner) {
        this.testRunner = testRunner;        
    }

    public testRunner: string;

    public publish(resultFiles, mergeResults, platform, config) {
        
        if(mergeResults == 'true') {
            _writeLine("Merging test results from multiple files to one test run is not supported on this version of build agent for OSX/Linux, each test result file will be published as a separate test run in VSO/TFS.");
        }
        
        var properties = <{[key: string]: string}>{};
        properties['type'] = this.testRunner;
        
        if(platform) {
            properties['platform'] = platform;
        }

        if(config) {
            properties['config'] = config;
        }

        for(var i = 0; i < resultFiles.length; i ++) {            
            writeCommand('results.publish',  properties, resultFiles[i]);
        }
    }
}

//-----------------------------------------------------
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;
trm.debug = debug;

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------
export function match(list, pattern, options) {
    return minimatch.match(list, pattern, options);
}

export function matchFile(list, pattern, options) {
    return minimatch(list, pattern, options);
}

export function filter(pattern, options) {
    return minimatch.filter(pattern, options);
}
