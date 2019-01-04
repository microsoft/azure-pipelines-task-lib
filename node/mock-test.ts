import cp = require('child_process');
import fs = require('fs');
import path = require('path');
import os = require('os');
import cmdm = require('./taskcommand');
import shelljs = require('shelljs');

const COMMAND_TAG = '[command]';
const COMMAND_LENGTH = COMMAND_TAG.length;

export class MockTestRunner {
    constructor(testPath: string) {
        this._testPath = testPath;
    }

    private _testPath: string;
    public stdout: string;
    public stderr: string;
    public cmdlines: any;
    public invokedToolCount: number;
    public succeeded: boolean;
    public errorIssues: string[];
    public warningIssues: string[];

    get failed(): boolean {
        return !this.succeeded;
    }
    
    public ran(cmdline: string): boolean {
        return this.cmdlines.hasOwnProperty(cmdline.trim());
    }

    public createdErrorIssue(message: string): boolean {
        return this.errorIssues.indexOf(message.trim()) >= 0;
    }

    public createdWarningIssue(message: string): boolean {
        return this.warningIssues.indexOf(message.trim()) >= 0;
    }    

    public stdOutContained(message: string): boolean {
        return this.stdout && this.stdout.indexOf(message) > 0;
    }

    public stdErrContained(message: string): boolean {
        return this.stderr && this.stderr.indexOf(message) > 0;
    }

    public run(): void {
        this.cmdlines = {};
        this.invokedToolCount = 0;
        this.succeeded = true;

        this.errorIssues = [];
        this.warningIssues = [];

        // we use node in the path.
        // if you want to test with a specific node, ensure it's in the path
        let nodePath = shelljs.which('node');
        if (!nodePath) {
            console.error('Could not find node in path');
            return;            
        }

        let spawn = cp.spawnSync(nodePath, [this._testPath]);
        if (spawn.error) {
            console.error('Running test failed');
            console.error(spawn.error.message);
            return;
        }

        this.stdout = spawn.stdout.toString();
        this.stderr = spawn.stderr.toString();

        if (process.env['TASK_TEST_TRACE']) {
            console.log('');
        }

        let lines: string[] = this.stdout.replace(/\r\n/g, '\n').split('\n');
        let traceFile: string = this._testPath + '.log';
        lines.forEach((line: string) => {
            let ci = line.indexOf('##vso[');
            let cmd: cmdm.TaskCommand;
            let cmi = line.indexOf(COMMAND_TAG);
            if (ci >= 0) {
                cmd = cmdm.commandFromString(line.substring(ci));
                if (cmd.command === 'task.complete' && cmd.properties['result'] === 'Failed') {
                    this.succeeded = false;
                }

                if (cmd.command === 'task.issue' && cmd.properties['type'] === 'error') {
                    this.errorIssues.push(cmd.message.trim());
                }

                if (cmd.command === 'task.issue' && cmd.properties['type'] === 'warning') {
                    this.warningIssues.push(cmd.message.trim());
                }
            }
            else if (cmi == 0 && line.length > COMMAND_LENGTH) {
                let cmdline: string = line.substr(COMMAND_LENGTH).trim();
                this.cmdlines[cmdline] = true;
                this.invokedToolCount++;
            }

            if (process.env['TASK_TEST_TRACE']) {
                fs.appendFileSync(traceFile, line + os.EOL);

                if (line && !cmd) {
                    console.log(line);
                }
                // don't print task.debug commands to console - too noisy.
                // otherwise omit command details - can interfere during CI.
                else if (cmd && cmd.command != 'task.debug') {
                    console.log(`${cmd.command} details omitted`);
                }
            }
        });

        if (this.stderr && process.env['TASK_TEST_TRACE']) {
            console.log('STDERR: ' + this.stderr);
            fs.appendFileSync(traceFile, 'STDERR: ' + this.stderr + os.EOL)
        }

        if (process.env['TASK_TEST_TRACE']) {
            console.log('TRACE FILE: ' + traceFile);
        }
    }
}
