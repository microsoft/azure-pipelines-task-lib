import cp = require('child_process');
import fs = require('fs');
import ncp = require('child_process');
import os = require('os');
import path = require('path');
import cmdm = require('./taskcommand');
import semver = require('semver');
import shelljs = require('shelljs');
import syncRequest = require('sync-request');
import { getPlatform } from './task';

const COMMAND_TAG = '[command]';
const COMMAND_LENGTH = COMMAND_TAG.length;
const testDirectory = path.join(__dirname, '_test');

export class MockTestRunner {
    constructor(testPath: string) {
        this._testPath = testPath;
        this.nodePath = this.getNodePath();
    }

    private _testPath: string;
    public nodePath: string;
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

        let spawn = cp.spawnSync(this.nodePath, [this._testPath]);
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

    // Returns a path to node.exe with the correct version for this task (based on if its node10 or node)
    private getNodePath() {
        const version = this.getNodeVersion();

        // Check if version needed can be found on the path.
        let nodePath = shelljs.which('node');
        if (nodePath) {
            try {
                const output = ncp.execSync(nodePath + ' -v').toString().trim();
                const versionType = version + '.x';
                if (semver.satisfies(output, versionType)) {
                    return nodePath;
                }
            }
            catch (err) {
                console.warn('Unable to get version of node in path, downloading node version instead.');
            }
        }

        let downloadVersion: string;
        switch (version) {
            case 5:
                downloadVersion = 'v5.10.1';
                break;
            case 6:
                downloadVersion = 'v6.10.3';
                break;
            case 10:
                downloadVersion = 'v10.15.1';
                break;
            default:
                throw new Error('Invalid node version, must be 5, 6, or 10 (received ' + version + ')');
        }

        // Install node in _test folder if it isn't already there.
        const downloadDestination = path.join(testDirectory, 'node' + version);
        const pathToExe = this.getPathToNodeExe(downloadVersion, downloadDestination);
        if (pathToExe) {
            return pathToExe;
        }
        else {
            return this.downloadNode(downloadVersion, downloadDestination);
        }
    }

    // Determines the correct version of node to use based on the contents of the task's task.json. Defaults to Node 10.
    private getNodeVersion(): number {
        if (process.env['useNodeVersion']) {
            return parseInt(process.env['useNodeVersion']);
        }

        const taskJsonPath: string = this.getTaskJsonPath();
        if (!taskJsonPath) {
            console.warn('Unable to find task.json, defaulting to use Node 10');
            return 10;
        }
        const taskJson: object = require(taskJsonPath);

        const execution = taskJson['execution'];
        let nodeVersion: number = 0;
        Object.keys(execution).forEach((key) => {
            if (key.toLowerCase() == 'node') {
                nodeVersion = 6;
            }
            else if (key.toLowerCase() == 'node10') {
                nodeVersion = 10;
            }
        });
        if (nodeVersion == 0) {
            console.warn('Unable to determine execution type from task.json, defaulting to use Node 10');
            return 10;
        }

        return nodeVersion;
    }

    // Returns the path to the task.json for the task being tested. Returns null if unable to find it.
    // Searches by moving up the directory structure from the initial starting point and checking at each level.
    private getTaskJsonPath(): string {
        let curPath = this._testPath;
        let newPath = path.join(this._testPath, '..');
        while (curPath != newPath) {
            curPath = newPath;
            let taskJsonPath = path.join(curPath, 'task.json');
            if (fs.existsSync(taskJsonPath)) {
                return taskJsonPath;
            }
            newPath = path.join(curPath, '..');
        }
        return null;
    }

    // Downloads the specified node version to the download destination. Returns a path to node.exe
    private downloadNode(nodeVersion: string, downloadDestination: string): string {
        const nodeUrl: string = 'https://nodejs.org/dist';
        switch (this.getPlatform()) {
            case 'darwin':
                this.downloadTarGz(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-darwin-x64.tar.gz', downloadDestination);
                return path.join(downloadDestination, 'node-' + nodeVersion + '-darwin-x64', 'bin', 'node');
            case 'linux':
                this.downloadTarGz(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-linux-x64.tar.gz', downloadDestination);
                return path.join(downloadDestination, 'node-' + nodeVersion + '-linux-x64', 'bin', 'node');
            case 'win32':
                this.downloadFile(nodeUrl + '/' + nodeVersion + '/win-x64/node.exe', downloadDestination, 'node.exe');
                this.downloadFile(nodeUrl + '/' + nodeVersion + '/win-x64/node.lib', downloadDestination, 'node.lib');
                return path.join(downloadDestination, 'node.exe')
        }
    }

    //Downloads file to the downloadDestination, making any necessary folders along the way.
    private downloadFile(url: string, downloadDestination: string, fileName: string): void {
        if (!url) {
            throw new Error('Parameter "url" must be set.');
        }
        if (!downloadDestination) {
            throw new Error('Parameter "downloadDestination" must be set.');
        }
        console.log('Downloading file:', url);
        shelljs.mkdir('-p', downloadDestination);
        const result = syncRequest('GET', url);
        fs.writeFileSync(path.join(downloadDestination, fileName), result.getBody());
    }

    // Downloads tarGz to the download destination, making any necessary folders along the way.
    private downloadTarGz(url: string, downloadDestination: string): void {
        if (!url) {
            throw new Error('Parameter "url" must be set.');
        }
        if (!downloadDestination) {
            throw new Error('Parameter "downloadDestination" must be set.');
        }
        const tarGzName: string = 'node.tar.gz';
        this.downloadFile(url, downloadDestination, tarGzName);
        
        // Extract file
        const originalCwd: string = process.cwd();
        this.cd(downloadDestination);
        try {
            ncp.execSync(`tar -xzf "${path.join(downloadDestination, tarGzName)}"`);
        }
        catch {
            throw new Error('Failed to unzip node tar.gz from ' + url);
        }
        finally {
            this.cd(originalCwd);
        }
    }

    // Checks if node is installed at downloadDestination. If it is, returns a path to node.exe, otherwise returns null.
    private getPathToNodeExe(nodeVersion: string, downloadDestination: string): string {
        let exePath: string;
        switch (this.getPlatform()) {
            case 'darwin':
                exePath = path.join(downloadDestination, 'node-' + nodeVersion + '-darwin-x64', 'bin', 'node');
                break;
            case 'linux':
                exePath = path.join(downloadDestination, 'node-' + nodeVersion + '-linux-x64', 'bin', 'node');
                break;
            case 'win32':
                exePath = path.join(downloadDestination, 'node.exe');
        }
        if (fs.existsSync(exePath)) {
            return exePath;
        }
        else {
            return null;
        }
    }

    private getPlatform(): string {
        let platform: string = os.platform();
        if (platform != 'darwin' && platform != 'linux' && platform != 'win32') {
            throw new Error('Unexpected platform: ' + platform);
        }
        return platform;
    }

    private cd(dir) {
        var cwd = process.cwd();
        if (cwd != dir) {
            shelljs.cd(dir);
            var errMsg = shelljs.error();
            if (errMsg) {
                throw new Error(errMsg);
            }
        }
    }
}