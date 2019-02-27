import cp = require('child_process');
import fs = require('fs');
import ncp = require('child_process');
import path = require('path');
import os = require('os');
import cmdm = require('./taskcommand');
import shelljs = require('shelljs');

const COMMAND_TAG = '[command]';
const COMMAND_LENGTH = COMMAND_TAG.length;

export class MockTestRunner {
    constructor(testPath: string, taskJsonPath: string) {
        this._testPath = testPath;
        if (taskJsonPath) {
            try {
                this._taskJson = require(taskJsonPath);
            }
            catch (err) {
                console.error('Unable to load task.json from taskJsonPath. Failed with error', err);
            }
        }
        else {
            console.warn('No taskJsonPath provided. Defaulting to use node 6 handler.');
        }

        // Try using path variable to find node, fallback to env variables.
        let nodePath = shelljs.which('node');
        try {
            var output = ncp.execSync(nodePath + ' -v').toString().trim();
            if (semver.satisfies(output, '5.x')) {
                this._node5Path = nodePath;
            }
            else if (semver.satisfies(output, '6.x')) {
                this._node6Path = nodePath;
            }
            else if (semver.satisfies(output, '10.x')) {
                this._node10Path = nodePath;
            }
        }
        catch (err) {
            console.warn('Unable to determine node from path version, failed with error', err);
        }

        if (process.env['node5Path']) {
            this._node10Path = process.env['node5Path'];
        }
        if (process.env['node6Path']) {
            this._node10Path = process.env['node6Path'];
        }
        if (process.env['node10Path']) {
            this._node10Path = process.env['node10Path'];
        }
    }

    private _testPath: string;
    private _taskJson: object;
    private _node10Path: string;
    private _node6Path: string;
    private _node5Path: string;
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

    public run(nodeVersion: number): void {
        this.cmdlines = {};
        this.invokedToolCount = 0;
        this.succeeded = true;

        this.errorIssues = [];
        this.warningIssues = [];

        if (!nodeVersion) {
            if (this._taskJson) {
                const execution = this._taskJson['execution'];
                Object.keys(execution).forEach((key) => {
                    if (key.toLowerCase() == 'node') {
                        nodeVersion = 6;
                    }
                    else if (key.toLowerCase() == 'node10') {
                        nodeVersion = 10;
                    }
                });
                if (!nodeVersion) {
                    console.warn('Unable to infer correct node handler from task.json. Defaulting to node 6');
                    nodeVersion = 6;
                }
            }
            else {
                // Default to node 6
                nodeVersion = 6;
            }
        }

        let nodePath: string;
        if (nodeVersion == 5) {
            nodePath = this._node5Path;
        }
        else if (nodeVersion == 6) {
            nodePath = this._node6Path;
        }
        else if (nodeVersion == 10) {
            nodePath = this._node10Path;
        }
        else {
            console.error('Invalid node version v%i. Only node 5, 6, and 10 are valid', nodeVersion);
        }

        if (!nodePath) {
            console.error('No node executable found for v%i. Please set env[\'node%iPath\'] to the path of the appropriate node.exe', nodeVersion, nodeVersion);
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
