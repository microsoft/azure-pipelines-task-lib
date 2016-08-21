/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import events = require('events');
import fs = require('fs');
import path = require('path');
import child = require('child_process');
let shell = require('shelljs');

function debug(message: string): void {
    if (process.env['TASK_TEST_TRACE']) {
        console.log(message);
    }
}

class PSEngineRunner extends events.EventEmitter {
    constructor() {
        super();
    }

    private _childProcess: child.ChildProcess;
    private _errors: string[];
    private _runDeferred: Q.Deferred<void>;
    public stderr: string;
    public stdout: string;

    public ensureKill(): void {
        if (this._childProcess) {
            this._childProcess.kill();
        }

        this._childProcess = undefined;
    }

    public run(psPath: string, done) {
        this.ensureStarted();
        this.runPromise(psPath)
        .then(() => {
            done();
        })
        .fail((err) => {
            done(err);
        });
    }

    private ensureStarted(): void {
        if (this._childProcess) {
            return;
        }

        this.emit('starting');
        var defer = Q.defer<void>();
        var powershell = shell.which('powershell.exe');
        this._childProcess = child.spawn(
            powershell, // command
            [ // args
                '-NoLogo',
                '-Sta',
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                '. ([System.IO.Path]::Combine(\'' + __dirname + '\', \'Start-Engine.ps1\'))'
            ],
            { // options
                cwd: __dirname,
                env: process.env
            });
        this._childProcess.stdout.on(
            'data',
            (data) => {
                // Check for special ouput indicating end of test.
                if (('' + data).indexOf('_END_OF_TEST_ce10a77a_') >= 0) {
                    if (this._errors.length > 0) {
                        this._runDeferred.reject(this._errors.join('\n'));
                    } else {
                        this._runDeferred.resolve(null);
                    }
                } else if (data != '\n') {
                    if (('' + data).match(/##vso\[task.logissue .*type=error/)) {
                        // The VstsTaskSdk converts error records to error issue commands.
                        debug('stdout: ' + data);
                        this._errors.push(data);
                    } else {
                        // Otherwise, normal stdout.
                        debug('stdout: ' + data);
                    }
                }
            });
        this._childProcess.stderr.on(
            'data',
            (data) => {
                // Stderr indicates an error record was written to PowerShell's error pipeline.
                debug('stderr: ' + data);
                this._errors.push(data);
            });
    }

    private runPromise(psPath: string): Q.Promise<void> {
        this.emit('running test');
        this._errors = [];
        this._runDeferred = Q.defer<void>();
        this._childProcess.stdin.write(psPath + '\n')
        return <Q.Promise<void>>this._runDeferred.promise;
    }
}

let _engineRunner: PSEngineRunner = new PSEngineRunner();

export function run(psPath: string, done): void {
    _engineRunner.run(psPath, done);
}

export function ensureStopped(): void {
    _engineRunner.ensureKill();
}
