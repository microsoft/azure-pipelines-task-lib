
/// <reference path="../definitions/node.d.ts" />
/// <reference path="../definitions/Q.d.ts" />

import Q = require('q');
import os = require('os');
import events = require('events');

var shell = require('shelljs');

export interface IExecOptions {
    cwd: string;
    env: { [key: string]: string };
    silent: boolean;
    failOnStdErr: boolean;
    ignoreReturnCode: boolean;
    outStream: NodeJS.WritableStream;
    errStream: NodeJS.WritableStream;
};

export function debug(message) {
    // do nothing, overridden
};

export class ToolRunner extends events.EventEmitter {
    constructor(toolPath) {
        debug('toolRunner toolPath: ' + toolPath);

        if(toolPath.indexOf(' ') > 0) {
            toolPath = '\'' + toolPath + '\'';
        }
        this.toolPath = toolPath;
        this.args = [];
        super();
    }

    public toolPath: string;
    public args: string[];

    public arg(arguments, raw) {
        if (arguments instanceof Array) {
            exports.debug(this.toolPath + ' arg: ' + JSON.stringify(arguments));
            this.args = this.args.concat(arguments);
        }
        else if (typeof(arguments) === 'string') {
            
            // single quote args with space unless raw is true
            if (arguments.indexOf(' ') > 0 && !raw) {
                arguments = '\'' + arguments + '\'';
            }

            exports.debug(this.toolPath + ' arg: ' + arguments);
            this.args.push(arguments);
        }
    }

    public exec(options: IExecOptions) {
        var defer = Q.defer();

        exports.debug('exec tool: ' + this.toolPath);
        exports.debug('Arguments:');
        this.args.forEach(function(arg) {
            exports.debug('   ' + arg);
        });

        var success = true;
        options = options || <IExecOptions>{};

        var ops: IExecOptions = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: options.silent || false,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false
        };

        var argString = this.args.join(' ') || '';
        var cmdString = this.toolPath;
        if (argString) {
            cmdString += (' ' + argString);
        }
        ops.outStream.write('[command]' + cmdString + os.EOL);

        var runCP = shell.exec(cmdString, {async: true, silent: true}, function(code, output) {
            exports.debug('rc:' + code);

            if (code != 0 && !ops.ignoreReturnCode) {
                success = false;
            }
            
            exports.debug('success:' + success);
            if (success) {
                defer.resolve(code);
            }
            else {
                defer.reject(new Error(this.toolPath + ' failed with return code: ' + code));
            }
        });

        runCP.stdout.on('data', function(data) {
            this.emit('stdout', data);

            if (!ops.silent) {
                ops.outStream.write(data);    
            }
        });

        runCP.stderr.on('data', function(data) {
            this.emit('stderr', data);

            success = !ops.failOnStdErr;
            if (!ops.silent) {
                var s = ops.failOnStdErr ? ops.errStream : ops.outStream;
                s.write(data);
            }
        })

        return defer.promise;
    }
}
