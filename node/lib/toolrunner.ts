
/// <reference path="../definitions/node.d.ts" />
/// <reference path="../definitions/Q.d.ts" />

import Q = require('q');
import os = require('os');
import events = require('events');
import child = require('child_process');

var run = function(cmd, callback) {
    console.log('running: ' + cmd);
    var output = '';
    try {
      
    }
    catch(err) {
        console.log(err.message);
    }

}

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
        this.silent = false;
        super();
    }

    public toolPath: string;
    public args: string[];
    public silent: boolean;

    private _debug(message) {
        if (!this.silent) {
            debug(message);
        }
        this.emit('debug', message);
    }

    public arg(arguments, raw) {
        if (arguments instanceof Array) {
            this._debug(this.toolPath + ' arg: ' + JSON.stringify(arguments));
            this.args = this.args.concat(arguments);
        }
        else if (typeof(arguments) === 'string') {
            
            // single quote args with space unless raw is true
            if (arguments.indexOf(' ') > 0 && !raw) {
                arguments = '\'' + arguments + '\'';
            }

            this._debug(this.toolPath + ' arg: ' + arguments);
            this.args.push(arguments);
        }
    }

    public exec(options: IExecOptions) {
        var defer = Q.defer();

        this._debug('exec tool: ' + this.toolPath);
        this._debug('Arguments:');
        this.args.forEach((arg) => {
            this._debug('   ' + arg);
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

        if (!ops.silent) {
            ops.outStream.write('[command]' + cmdString + os.EOL);    
        }

        // TODO: filter process.env

        var cp = child.spawn(this.toolPath, this.args, {env: process.env});

        cp.stdout.on('data', (data) => {
            this.emit('stdout', data);

            if (!ops.silent) {
                ops.outStream.write(data);    
            }
        });

        cp.stderr.on('data', (data) => {
            this.emit('stderr', data);

            success = !ops.failOnStdErr;
            if (!ops.silent) {
                var s = ops.failOnStdErr ? ops.errStream : ops.outStream;
                s.write(data);
            }
        });

        cp.on('error', (err) => {
            defer.reject(new Error(this.toolPath + ' failed. ' + err.message));
        });

        cp.on('exit', (code, signal) => {
            this._debug('rc:' + code);

            if (code != 0 && !ops.ignoreReturnCode) {
                success = false;
            }
            
            this._debug('success:' + success);
            if (success) {
                defer.resolve(code);
            }
            else {
                defer.reject(new Error(this.toolPath + ' failed with return code: ' + code));
            }
        });

        return defer.promise;
    }
}
