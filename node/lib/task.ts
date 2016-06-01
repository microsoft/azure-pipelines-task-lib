/// <reference path="../typings/main.d.ts" />

import Q = require('q');
import shell = require('shelljs');
import fs = require('fs');
import path = require('path');
import os = require('os');
import minimatch = require('minimatch');
import globm = require('glob');
import util = require('util');
import tcm = require('./taskcommand');
import trm = require('./toolrunner');
import vm = require('./vault');
import semver = require('semver');
require('./extensions');

export enum TaskResult {
    Succeeded = 0,
    Failed = 1
}

var vault: vm.Vault;

//-----------------------------------------------------
// String convenience
//-----------------------------------------------------

function startsWith(str: string, start: string): boolean {
    return str.slice(0, start.length) == start;
}

function endsWith(str: string, end: string): boolean {
    return str.slice(-str.length) == end;
}

//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------
export var _outStream = process.stdout;
export var _errStream = process.stderr;

export function _writeError(str: string): void {
    _errStream.write(str + os.EOL);
}

export function _writeLine(str: string): void {
    _outStream.write(str + os.EOL);
}

export function setStdStream(stdStream): void {
    _outStream = stdStream;
}

export function setErrStream(errStream): void {
    _errStream = errStream;
}


//-----------------------------------------------------
// Results
//-----------------------------------------------------

/**
 * Sets the result of the task.
 * If the result is Failed (1), then execution will halt.  
 * 
 * @param result    TaskResult enum of Success or Failed.  If the result is Failed (1), then execution will halt.
 * @param message   A message which will be logged as an error issue if the result is Failed.
 * @returns         void
 */
export function setResult(result: TaskResult, message: string): void {
    debug('task result: ' + TaskResult[result]);

    // add an error issue
    if (result == TaskResult.Failed && message) {
        error(message);
    }

    // set the task result
    command('task.complete', { 'result': TaskResult[result] }, message);
}

//
// Catching all exceptions
//
process.on('uncaughtException', (err) => {
    setResult(TaskResult.Failed, loc('LIB_UnhandledEx', err.message));
});

//-----------------------------------------------------
// Loc Helpers
//-----------------------------------------------------
var locStringCache: {
    [key: string]: string
} = {};
var resourceFile: string;
var libResourceFileLoaded: boolean = false;
var resourceCulture: string = 'en-US';

function loadResJson(resjsonFile: string): any {
    var resJson: {} = null;
    if (exist(resjsonFile)) {
        var resjsonContent = fs.readFileSync(resjsonFile, 'utf8').toString();
        // remove BOM
        if (resjsonContent.indexOf('\uFEFF') == 0) {
            resjsonContent = resjsonContent.slice(1);
        }

        try {
            resJson = JSON.parse(resjsonContent);
        }
        catch (err) {
            debug('unable to parse resjson with err: ' + err.message);
            resJson = null;
        }
    }
    else {
        debug('.resjson file not found: ' + resjsonFile);
    }

    return resJson;
}

function loadLocStrings(resourceFile: string, culture: string): { [key: string]: string; } {
    var locStrings: {
        [key: string]: string
    } = {};

    if (exist(resourceFile)) {
        var resourceJson = require(resourceFile);
        if (resourceJson && resourceJson.hasOwnProperty('messages')) {
            var locResourceJson = null;
            // load up resource resjson for different culture

            var localizedResourceFile = path.join(path.dirname(resourceFile), 'Strings', 'resources.resjson');
            var upperCulture = culture.toUpperCase();
            var cultures = [];
            try { cultures = fs.readdirSync(localizedResourceFile); }
            catch (ex) { }
            for (var i = 0; i < cultures.length; i++) {
                if (cultures[i].toUpperCase() == upperCulture) {
                    localizedResourceFile = path.join(localizedResourceFile, cultures[i], 'resources.resjson');
                    if (exist(localizedResourceFile)) {
                        locResourceJson = loadResJson(localizedResourceFile);
                    }

                    break;
                }
            }

            for (var key in resourceJson.messages) {
                if (locResourceJson && locResourceJson.hasOwnProperty('loc.messages.' + key)) {
                    locStrings[key] = locResourceJson['loc.messages.' + key];
                }
                else {
                    locStrings[key] = resourceJson.messages[key];
                }
            }
        }
    }
    else {
        warning(loc('LIB_ResourceFileNotExist', resourceFile));
    }

    return locStrings;
}

/**
 * Sets the location of the resources json.  This is typically the task.json file.
 * Call once at the beginning of the script before any calls to loc.
 * 
 * @param     path      Full path to the json.
 * @returns   void
 */
export function setResourcePath(path: string): void {
    if (process.env['TASKLIB_INPROC_UNITS']) {
        resourceFile = null;
        libResourceFileLoaded = false;
        locStringCache = {};
        resourceCulture = 'en-US';
    }

    if (!resourceFile) {
        checkPath(path, 'resource file path');
        resourceFile = path;
        debug('set resource file to: ' + resourceFile);

        resourceCulture = getVariable('system.culture') || resourceCulture;
        var locStrs = loadLocStrings(resourceFile, resourceCulture);
        for (var key in locStrs) {
            //cache loc string
            locStringCache[key] = locStrs[key];
        }

    }
    else {
        warning(loc('LIB_ResourceFileAlreadySet', resourceFile));
    }
}

/**
 * Gets the localized string from the json resource file.  Optionally formats with additional params.
 * 
 * @param     key      key of the resources string in the resource file
 * @param     param    additional params for formatting the string
 * @returns   string
 */
export function loc(key: string, ...param: any[]): string {
    if (!libResourceFileLoaded) {
        // merge loc strings from vsts-task-lib.
        var libResourceFile = path.join(__dirname, 'lib.json');
        var libLocStrs = loadLocStrings(libResourceFile, resourceCulture);
        for (var libKey in libLocStrs) {
            //cache vsts-task-lib loc string
            locStringCache[libKey] = libLocStrs[libKey];
        }

        libResourceFileLoaded = true;
    }

    var locString;;
    if (locStringCache.hasOwnProperty(key)) {
        locString = locStringCache[key];
    }
    else {
        if (!resourceFile) {
            warning(loc('LIB_ResourceFileNotSet', key));
        }
        else {
            warning(loc('LIB_LocStringNotFound', key));
        }

        locString = key;
    }

    if (param.length > 0) {
        return util.format.apply(this, [locString].concat(param));
    }
    else {
        return locString;
    }
}

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
/**
 * Gets a variables value which is defined on the build definition or set at runtime.
 * 
 * @param     name     name of the variable to get
 * @returns   string
 */
export function getVariable(name: string): string {
    var varval = process.env[name.replace(/\./g, '_').toUpperCase()];
    debug(name + '=' + varval);
    return varval;
}

/**
 * Sets a variables which will be available to subsequent tasks as well.
 * 
 * @param     name     name of the variable to set
 * @param     val     value to set
 * @returns   void
 */
export function setVariable(name: string, val: string): void {
    if (!name) {
        throw new Error(loc('LIB_ParameterIsRequired', 'name'));
    }

    var varValue = val || '';
    process.env[name.replace(/\./g, '_').toUpperCase()] = varValue;
    debug('set ' + name + '=' + varValue);
    command('task.setvariable', { 'variable': name || '' }, varValue);
}

/**
 * Gets the value of an input.  The value is also trimmed.
 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
 * 
 * @param     name     name of the input to get
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string
 */
export function getInput(name: string, required?: boolean): string {
    var inval = vault.retrieveSecret('INPUT_' + name.replace(' ', '_').toUpperCase());
    if (inval) {
        inval = inval.trim();
    }

    if (required && !inval) {
        throw new Error(loc('LIB_InputRequired', name));
    }

    debug(name + '=' + inval);
    return inval;
}

/**
 * Gets the value of an input and converts to a bool.  Convenience.
 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
 * 
 * @param     name     name of the bool input to get
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string
 */
export function getBoolInput(name: string, required?: boolean): boolean {
    return getInput(name, required) == "true";
}

// deprecated - use  setVariable
export function setEnvVar(name: string, val: string): void {
    if (val) {
        process.env[name] = val;
    }
}

/**
 * Gets the value of an input and splits the value using a delimiter (space, comma, etc).
 * Empty values are removed.  This function is useful for splitting an input containing a simple
 * list of items - such as build targets.
 * IMPORTANT: Do not use this function for splitting additional args!  Instead use argString(), which
 * follows normal argument splitting rules and handles values encapsulated by quotes.
 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
 * 
 * @param     name     name of the input to get
 * @param     delim    delimiter to split on
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string[]
 */
export function getDelimitedInput(name: string, delim: string, required?: boolean): string[] {
    var inval = getInput(name, required);
    if (!inval) {
        return [];
    }

    var result = [];
    inval.split(delim).forEach(x => {
        if (x) {
            result.push(x);
        }
    });

    return result;
}

/**
 * Checks whether a path inputs value was supplied by the user
 * File paths are relative with a picker, so an empty path is the root of the repo.
 * Useful if you need to condition work (like append an arg) if a value was supplied
 * 
 * @param     name      name of the path input to check
 * @returns   boolean
 */
export function filePathSupplied(name: string): boolean {
    // normalize paths
    var pathValue = path.resolve(this.getPathInput(name) || '');
    var repoRoot = path.resolve(this.getVariable('build.sourcesDirectory') || '');

    var supplied = pathValue !== repoRoot;
    debug(name + 'path supplied :' + supplied);
    return supplied;
}

/**
 * Gets the value of a path input
 * It will be quoted for you if it isn't already and contains spaces
 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
 * If check is true and the path does not exist, the task will fail with an error.  Execution halts.
 * 
 * @param     name      name of the input to get
 * @param     required  whether input is required.  optional, defaults to false
 * @param     check     whether path is checked.  optional, defaults to false 
 * @returns   string
 */
export function getPathInput(name: string, required?: boolean, check?: boolean): string {
    var inval = getInput(name, required);
    if (inval) {
        if (check) {
            checkPath(inval, name);
        }
    }

    return inval;
}

//-----------------------------------------------------
// Endpoint Helpers
//-----------------------------------------------------

/**
 * Gets the url for a service endpoint
 * If the url was not set and is not optional, the task will fail with an error message. Execution will halt.
 * 
 * @param     id        name of the service endpoint
 * @param     optional  whether the url is optional
 * @returns   string
 */
export function getEndpointUrl(id: string, optional: boolean): string {
    var urlval = process.env['ENDPOINT_URL_' + id];

    if (!optional && !urlval) {
        throw new Error(loc('LIB_EndpointNotExist', id));
    }

    debug(id + '=' + urlval);
    return urlval;
}

/**
 * Interface for EndpointAuthorization
 * Contains a schema and a string/string dictionary of auth data
 * 
 * @param     parameters        string string dictionary of auth data
 * @param     scheme            auth scheme such as OAuth or username/password etc...
 */
export interface EndpointAuthorization {
    parameters: {
        [key: string]: string;
    };
    scheme: string;
}

/**
 * Gets the authorization details for a service endpoint
 * If the authorization was not set and is not optional, the task will fail with an error message. Execution will halt.
 * 
 * @param     id        name of the service endpoint
 * @param     optional  whether the url is optional
 * @returns   string
 */
export function getEndpointAuthorization(id: string, optional: boolean): EndpointAuthorization {
    var aval = vault.retrieveSecret('ENDPOINT_AUTH_' + id);

    if (!optional && !aval) {
        setResult(TaskResult.Failed, loc('LIB_EndpointNotExist', id));
    }

    console.log(id + ' exists ' + (aval !== null));
    debug(id + ' exists ' + (aval !== null));

    var auth: EndpointAuthorization;
    try {
        auth = <EndpointAuthorization>JSON.parse(aval);
    }
    catch (err) {
        throw new Error(loc('LIB_InvalidEndpointAuth', aval)); 
    }

    return auth;
}


//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
export function command(command: string, properties, message: string) {
    var taskCmd = new tcm.TaskCommand(command, properties, message);
    _writeLine(taskCmd.toString());
}

export function warning(message: string): void {
    command('task.issue', { 'type': 'warning' }, message);
}

export function error(message: string): void {
    command('task.issue', { 'type': 'error' }, message);
}

export function debug(message: string): void {
    command('task.debug', null, message);
}

//-----------------------------------------------------
// Disk Functions
//-----------------------------------------------------
function checkShell(cmd: string, continueOnError?: boolean) {
    var se = shell.error();
    
    if (se) {
        debug(cmd + ' failed');
        var errMsg = loc('LIB_OperationFailed', cmd, se);
        debug(errMsg);

        if (!continueOnError) {
            throw new Error(errMsg);    
        }
    }
}

export interface FsStats extends fs.Stats {

}

/**
 * Get's stat on a path. 
 * Useful for checking whether a file or directory.  Also getting created, modified and accessed time.
 * see [fs.stat](https://nodejs.org/api/fs.html#fs_class_fs_stats)
 * 
 * @param     path      path to check
 * @returns   fsStat 
 */
export function stats(path: string): FsStats {
    return fs.statSync(path);
}

/**
 * Returns whether a path exists.
 * 
 * @param     path      path to check
 * @returns   boolean 
 */
export function exist(path: string): boolean {
    try {
        return path && fs.statSync(path) != null;
    } catch (err) {
        return false;
    }
}

/**
 * Checks whether a path exists.
 * If the path does not exist, the task will fail with an error message. Execution will halt.
 * 
 * @param     p         path to check
 * @param     name      name only used in error message to identify the path
 * @returns   void
 */
export function checkPath(p: string, name: string): void {
    debug('check path : ' + p);
    if (!exist(p)) {
        throw new Error(loc('LIB_PathNotFound', name, p));
    }
}

/**
 * Change working directory.
 * 
 * @param     path      new working directory path
 * @returns   void 
 */
export function cd(path: string): void {
    if (path) {
        shell.cd(path);
        checkShell('cd');
    }
}

/**
 * Change working directory and push it on the stack
 * 
 * @param     path      new working directory path
 * @returns   void
 */
export function pushd(path: string): void {
    shell.pushd(path);
    checkShell('pushd');
}

/**
 * Change working directory back to previously pushed directory
 * 
 * @returns   void
 */
export function popd(): void {
    shell.popd();
    checkShell('popd');
}

/**
 * Make a directory.  Creates the full path with folders in between
 * Returns whether it was successful or not
 * 
 * @param     p       path to create
 */
export function mkdirP(p): void {
    if (!p) {
        throw new Error(loc('LIB_ParameterIsRequired', 'p'));
    }

    // certain chars like \0 will cause shelljs and fs
    // to blow up without exception or error
    if (p.indexOf('\0') >= 0) {
        throw new Error(loc('LIB_PathHasNullByte'));
    }

    if (!shell.test('-d', p)) {
        debug('creating path: ' + p);
        shell.mkdir('-p', p);
        checkShell('mkdirP');
    }
    else {
        debug('path exists: ' + p);
    }
}

/**
 * Returns path of a tool had the tool actually been invoked.  Resolves via paths.
 * If you check and the tool does not exist, the task will fail with an error message and halt execution.
 * 
 * @param     tool       name of the tool
 * @param     check      whether to check if tool exists
 * @returns   string
 */
export function which(tool: string, check?: boolean): string {
    try {
        // we can't use shelljs.which() on windows due to https://github.com/shelljs/shelljs/issues/238
        // shelljs.which() does not prefer file with executable extensions (.exe, .bat, .cmd).
        // we already made a PR for Shelljs, but they haven't merge it yet. https://github.com/shelljs/shelljs/pull/239
        if (os.type().match(/^Win/)) {
            var pathEnv = process.env.path || process.env.Path || process.env.PATH;
            var pathArray = pathEnv.split(';');
            var toolPath: string = null;

            // No relative/absolute paths provided?
            if (tool.search(/[\/\\]/) === -1) {
                // Search for command in PATH
                pathArray.forEach(function(dir) {
                    if (toolPath)
                        return; // already found it

                    var attempt = path.resolve(dir + '/' + tool);

                    var baseAttempt = attempt;
                    attempt = baseAttempt + '.exe';
                    if (exist(attempt) && stats(attempt).isFile) {
                        toolPath = attempt;
                        return;
                    }
                    attempt = baseAttempt + '.cmd';
                    if (exist(attempt) && stats(attempt).isFile) {
                        toolPath = attempt;
                        return;
                    }
                    attempt = baseAttempt + '.bat';
                    if (exist(attempt) && stats(attempt).isFile) {
                        toolPath = attempt;
                        return;
                    }
                });
            }

            // Command not found in Path, but the input itself is point to a file.
            if (!toolPath && exist(tool) && stats(tool).isFile) {
                toolPath = path.resolve(tool);
            }
        }
        else {
            var toolPath = shell.which(tool);
        }

        if (check) {
            checkPath(toolPath, tool);
        }

        debug(tool + '=' + toolPath);
        return toolPath;
    }
    catch (err) {
        throw new Error(loc('LIB_OperationFailed', 'which', err.message));
    }
}

/**
 * Returns path of a tool had the tool actually been invoked.  Resolves via paths.
 * If you check and the tool does not exist, the task will fail with an error message and halt execution.
 * Returns whether the copy was successful
 * 
 * @param     source     source path
 * @param     dest       destination path
 * @param     options    string -r, -f or -rf for recursive and force 
 * @param     continueOnError optional. whether to continue on error
 */
export function cp(source: string, dest: string, options?: string, continueOnError?: boolean): void {
    if (options) {
        shell.cp(options, source, dest);    
    }
    else {
        shell.cp(source, dest);
    }
    
    checkShell('cp', continueOnError);
}

/**
 * Moves a path.  
 * Returns whether the copy was successful
 * 
 * @param     source     source path
 * @param     dest       destination path
 * @param     options    string -f or -n for force and no clobber 
 * @param     continueOnError optional. whether to continue on error
 */
export function mv(source: string, dest: string, options?: string, continueOnError?: boolean): void {
    if (options) {
        shell.mv(options, source, dest);    
    }
    else {
        shell.mv(source, dest);
    }
    
    checkShell('mv', continueOnError);
}

/**
 * Find all files under a give path 
 * Returns an array of full paths
 * 
 * @param     findPath     path to find files under
 * @returns   string[]
 */
export function find(findPath: string): string[] {
    try {
        if (!shell.test('-e', findPath)) {
            return [];
        }
        var matches = shell.find(findPath);
        debug('find ' + findPath);
        debug(matches.length + ' matches.');
        return matches;
    }
    catch (err) {
        throw new Error(loc('LIB_OperationFailed', 'find', err.message));
    }
}

/**
 * Remove a path recursively with force
 * Returns whether it succeeds
 * 
 * @param     path     path to remove
 * @param     continueOnError optional. whether to continue on error
 * @returns   string[]
 */
export function rmRF(path: string, continueOnError?: boolean): void {
    debug('rm -rf ' + path);
    shell.rm('-rf', path);

    var errMsg: string = shell.error();

    // if you try to delete a file that doesn't exist, desired result is achieved
    // other errors are valid
    if (errMsg && !(errMsg.indexOf('ENOENT') === 0)) {
        throw new Error(loc('LIB_OperationFailed', 'rmRF', errMsg));
    }
}

export function glob(pattern: string): string[] {
    debug('glob ' + pattern);
    var matches: string[] = globm.sync(pattern);
    debug('found ' + matches.length + ' matches');

    if (matches.length > 0) {
        var m = Math.min(matches.length, 10);
        debug('matches:');
        if (m == 10) {
            debug('listing first 10 matches as samples');
        }

        for (var i = 0; i < m; i++) {
            debug(matches[i]);
        }
    }

    return matches;
}

export function globFirst(pattern: string): string {
    debug('globFirst ' + pattern);
    var matches = glob(pattern);

    if (matches.length > 1) {
        warning(loc('LIB_UseFirstGlobMatch'));
    }

    debug('found ' + matches.length + ' matches');

    return matches[0];
}

/**
 * Exec a tool.  Convenience wrapper over ToolRunner to exec with args in one call.
 * Output will be streamed to the live console.
 * Returns promise with return code
 * 
 * @param     tool     path to tool to exec
 * @param     args     an arg string or array of args
 * @param     options  optional exec options.  See IExecOptions
 * @returns   number
 */
export function exec(tool: string, args: any, options?: trm.IExecOptions): Q.Promise<number> {
    var toolPath = which(tool, true);
    var tr = createToolRunner(toolPath);
    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof(args) === 'string') {
            tr.argString(args)
        }
    }
    return tr.exec(options);
}

/**
 * Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
 * Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
 * Appropriate for short running tools 
 * Returns IExecResult with output and return code
 * 
 * @param     tool     path to tool to exec
 * @param     args     an arg string or array of args
 * @param     options  optionalexec options.  See IExecOptions
 * @returns   IExecResult
 */
export function execSync(tool: string, args: string | string[], options?: trm.IExecOptions): trm.IExecResult {
    var toolPath = which(tool, true);
    var tr = createToolRunner(toolPath);
    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof(args) === 'string') {
            tr.argString(args)
        }
    }

    return tr.execSync(options);
}

/**
 * Convenience factory to create a ToolRunner.
 * 
 * @param     tool     path to tool to exec
 * @returns   ToolRunner
 */
export function createToolRunner(tool: string) {
    var tr: trm.ToolRunner = new trm.ToolRunner(tool);
    tr.on('debug', (message: string) => {
        debug(message);
    })

    return tr;
}

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------
export function match(list, pattern, options): string[] {
    return minimatch.match(list, pattern, options);
}

export function filter(pattern, options): (element: string, indexed: number, array: string[]) => boolean {
    return minimatch.filter(pattern, options);
}

//-----------------------------------------------------
// Test Publisher
//-----------------------------------------------------
export class TestPublisher {
    constructor(testRunner) {
        this.testRunner = testRunner;
    }

    public testRunner: string;

    public publish(resultFiles, mergeResults, platform, config, runTitle, publishRunAttachments) {

        var properties = <{ [key: string]: string }>{};
        properties['type'] = this.testRunner;

        if (mergeResults) {
            properties['mergeResults'] = mergeResults;
        }

        if (platform) {
            properties['platform'] = platform;
        }

        if (config) {
            properties['config'] = config;
        }

        if (runTitle) {
            properties['runTitle'] = runTitle;
        }

        if (publishRunAttachments) {
            properties['publishRunAttachments'] = publishRunAttachments;
        }

        if (resultFiles) {
            properties['resultFiles'] = resultFiles;
        }

        command('results.publish', properties, '');
    }
}

//-----------------------------------------------------
// Code coverage Publisher
//-----------------------------------------------------
export class CodeCoveragePublisher {
    constructor() {
    }
    public publish(codeCoverageTool, summaryFileLocation, reportDirectory, additionalCodeCoverageFiles) {

        var properties = <{ [key: string]: string }>{};

        if (codeCoverageTool) {
            properties['codecoveragetool'] = codeCoverageTool;
        }

        if (summaryFileLocation) {
            properties['summaryfile'] = summaryFileLocation;
        }

        if (reportDirectory) {
            properties['reportdirectory'] = reportDirectory;
        }

        if (additionalCodeCoverageFiles) {
            properties['additionalcodecoveragefiles'] = additionalCodeCoverageFiles;
        }

        command('codecoverage.publish', properties, "");
    }
}

//-----------------------------------------------------
// Code coverage Publisher
//-----------------------------------------------------
export class CodeCoverageEnabler {
    private buildTool: string;
    private ccTool: string;

    constructor(buildTool: string, ccTool: string) {
        this.buildTool = buildTool;
        this.ccTool = ccTool;
    }

    public enableCodeCoverage(buildProps: { [key: string]: string }) {
        buildProps['buildtool'] = this.buildTool;
        buildProps['codecoveragetool'] = this.ccTool;
        command('codecoverage.enable', buildProps, "");
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
// Validation Checks
//-----------------------------------------------------

// async await needs generators in node 4.x+
if (semver.lt(process.versions.node, '4.2.0')) {
    this.warning('Tasks require a new agent.  Upgrade your agent or node to 4.2.0 or later');
}

//-------------------------------------------------------------------
// Populate the vault with sensitive data.  Inputs and Endpoints
//-------------------------------------------------------------------

// only exposed as a function so unit tests can reload vault for each test
// in prod, it's called globally below so user does not need to call

export function _loadData(): void {
    // in agent, workFolder is set.  
    // In interactive dev mode, it won't be    
    var keyPath = getVariable("agent.workFolder") || process.cwd();
    vault = new vm.Vault(keyPath);
    debug('loading inputs and endpoints');
    var loaded = 0;
    for (var envvar in process.env) {
        if (envvar.startsWith('INPUT_') ||
            envvar.startsWith('ENDPOINT_AUTH_')) {

            if (process.env[envvar]) {
                ++loaded;
                debug('loading ' + envvar);
                vault.storeSecret(envvar, process.env[envvar]);
                delete process.env[envvar];
            }
        }
    }
    debug('loaded ' + loaded);
}

_loadData();

