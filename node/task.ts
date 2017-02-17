import Q = require('q');
import shell = require('shelljs');
import fs = require('fs');
import path = require('path');
import os = require('os');
import minimatch = require('minimatch');
import util = require('util');
import tcm = require('./taskcommand');
import trm = require('./toolrunner');
import vm = require('./vault');
import semver = require('semver');

export enum TaskResult {
    Succeeded = 0,
    SucceededWithIssues = 1,
    Failed = 2
}

let _internal = { } as any;
if (process.env.TASKLIB_INPROC_UNITS) {
    module.exports._internal = _internal;
}

/**
 * Hash table of known variable info. The formatted env var name is the lookup key.
 *
 * The purpose of this hash table is to keep track of known variables. The hash table
 * needs to be maintained for multiple reasons:
 *  1) to distinguish between env vars and job vars
 *  2) to distinguish between secret vars and public
 *  3) to know the real variable name and not just the formatted env var name.
 */
let _knownVariableMap: { [key: string]: _KnownVariableInfo; } = { };

let _vault: vm.Vault;

//-----------------------------------------------------
// String convenience
//-----------------------------------------------------

function _startsWith(str: string, start: string): boolean {
    return str.slice(0, start.length) == start;
}

function _endsWith(str: string, end: string): boolean {
    return str.slice(-end.length) == end;
}

//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------
let _outStream = process.stdout;
let _errStream = process.stderr;

function _writeError(str: string): void {
    _errStream.write(str + os.EOL);
}

function _writeLine(str: string): void {
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
 * Execution will continue.
 * If not set, task will be Succeeded.
 * If multiple calls are made to setResult the most pessimistic call wins (Failed) regardless of the order of calls.
 * 
 * @param result    TaskResult enum of Succeeded, SucceededWithIssues or Failed.  
 * @param message   A message which will be logged as an error issue if the result is Failed.
 * @returns         void
 */
export function setResult(result: TaskResult, message: string): void {
    debug('task result: ' + TaskResult[result]);

    // add an error issue
    if (result == TaskResult.Failed && message) {
        error(message);
    }
    else if (result == TaskResult.SucceededWithIssues && message) {
        warning(message);
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
let _locStringCache: { [key: string]: string } = {};
let _resourceFile: string;
let _libResourceFileLoaded: boolean = false;
let _resourceCulture: string = 'en-US';

function _loadResJson(resjsonFile: string): any {
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

function _loadLocStrings(resourceFile: string, culture: string): { [key: string]: string; } {
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
                        locResourceJson = _loadResJson(localizedResourceFile);
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
        _resourceFile = null;
        _libResourceFileLoaded = false;
        _locStringCache = {};
        _resourceCulture = 'en-US';
    }

    if (!_resourceFile) {
        checkPath(path, 'resource file path');
        _resourceFile = path;
        debug('set resource file to: ' + _resourceFile);

        _resourceCulture = getVariable('system.culture') || _resourceCulture;
        var locStrs = _loadLocStrings(_resourceFile, _resourceCulture);
        for (var key in locStrs) {
            //cache loc string
            _locStringCache[key] = locStrs[key];
        }

    }
    else {
        warning(loc('LIB_ResourceFileAlreadySet', _resourceFile));
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
    if (!_libResourceFileLoaded) {
        // merge loc strings from vsts-task-lib.
        var libResourceFile = path.join(__dirname, 'lib.json');
        var libLocStrs = _loadLocStrings(libResourceFile, _resourceCulture);
        for (var libKey in libLocStrs) {
            //cache vsts-task-lib loc string
            _locStringCache[libKey] = libLocStrs[libKey];
        }

        _libResourceFileLoaded = true;
    }

    var locString;;
    if (_locStringCache.hasOwnProperty(key)) {
        locString = _locStringCache[key];
    }
    else {
        if (!_resourceFile) {
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
 * Gets a variable value that is defined on the build/release definition or set at runtime.
 * 
 * @param     name     name of the variable to get
 * @returns   string
 */
export function getVariable(name: string): string {
    let varval: string;

    // get the metadata
    let info: _KnownVariableInfo;
    let key: string = _getVariableKey(name);
    if (_knownVariableMap.hasOwnProperty(key)) {
        info = _knownVariableMap[key];
    }

    if (info && info.secret) {
        // get the secret value
        varval = _vault.retrieveSecret('SECRET_' + key);
    }
    else {
        // get the public value
        varval = process.env[key];

        // fallback for pre 2.104.1 agent
        if (!varval && name.toUpperCase() == 'AGENT.JOBSTATUS') {
            varval = process.env['agent.jobstatus'];
        }
    }

    debug(name + '=' + varval);
    return varval;
}

/**
 * Gets a snapshot of the current state of all job variables available to the task.
 * Requires a 2.104.1 agent or higher for full functionality.
 *
 * Limitations on an agent prior to 2.104.1:
 *  1) The return value does not include all public variables. Only public variables
 *     that have been added using setVariable are returned.
 *  2) The name returned for each secret variable is the formatted environment variable
 *     name, not the actual variable name (unless it was set explicitly at runtime using
 *     setVariable).
 *
 * @returns VariableInfo[]
 */
export function getVariables(): VariableInfo[] {
    return Object.keys(_knownVariableMap)
        .map((key: string) => {
            let info: _KnownVariableInfo = _knownVariableMap[key];
            return <VariableInfo>{ name: info.name, value: getVariable(info.name), secret: info.secret };
        });
}

/**
 * Sets a variable which will be available to subsequent tasks as well.
 * 
 * @param     name    name of the variable to set
 * @param     val     value to set
 * @param     secret  whether variable is secret.  optional, defaults to false
 * @returns   void
 */
export function setVariable(name: string, val: string, secret: boolean = false): void {
    // once a secret always a secret
    let key: string = _getVariableKey(name);
    if (_knownVariableMap.hasOwnProperty(key)) {
        secret = secret || _knownVariableMap[key].secret;
    }

    // store the value
    let varValue = val || '';
    debug('set ' + name + '=' + (secret && varValue ? '********' : varValue));
    if (secret) {
        _vault.storeSecret('SECRET_' + key, varValue);
        delete process.env[key];
    } else {
        process.env[key] = varValue;
    }

    // store the metadata
    _knownVariableMap[key] = <_KnownVariableInfo>{ name: name, secret: secret };

    // write the command
    command('task.setvariable', { 'variable': name || '', 'secret': (secret || false).toString() }, varValue);
}

function _getVariableKey(name: string): string {
    if (!name) {
        throw new Error(loc('LIB_ParameterIsRequired', 'name'));
    }

    return name.replace(/\./g, '_').replace(/ /g, '_').toUpperCase();
}

/**
 * Used to store the following information about job variables:
 *  1) the real variable name (not the formatted environment variable name)
 *  2) whether the variable is a secret variable
 */
interface _KnownVariableInfo {
    name: string;
    secret: boolean;
}

/** Snapshot of a variable at the time when getVariables was called. */
export interface VariableInfo {
    name: string;
    value: string;
    secret: boolean;
}

/**
 * Gets the value of an input.  The value is also trimmed.
 * If required is true and the value is not set, it will throw.
 * 
 * @param     name     name of the input to get
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string
 */
export function getInput(name: string, required?: boolean): string {
    var inval = _vault.retrieveSecret('INPUT_' + name.replace(' ', '_').toUpperCase());
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
 * If required is true and the value is not set, it will throw.
 * 
 * @param     name     name of the bool input to get
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string
 */
export function getBoolInput(name: string, required?: boolean): boolean {
    return (getInput(name, required) || '').toUpperCase() == "TRUE";
}

/**
 * Gets the value of an input and splits the value using a delimiter (space, comma, etc).
 * Empty values are removed.  This function is useful for splitting an input containing a simple
 * list of items - such as build targets.
 * IMPORTANT: Do not use this function for splitting additional args!  Instead use argString(), which
 * follows normal argument splitting rules and handles values encapsulated by quotes.
 * If required is true and the value is not set, it will throw.
 * 
 * @param     name     name of the input to get
 * @param     delim    delimiter to split on
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string[]
 */
export function getDelimitedInput(name: string, delim: string, required?: boolean): string[] {
    let inputVal = getInput(name, required);
    if (!inputVal) {
        return [];
    }

    let result: string[] = [];
    inputVal.split(delim).forEach((x: string) => {
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
    var pathValue = this.resolve(this.getPathInput(name) || '');
    var repoRoot = this.resolve(this.getVariable('build.sourcesDirectory') || this.getVariable('system.defaultWorkingDirectory') || '');

    var supplied = pathValue !== repoRoot;
    debug(name + 'path supplied :' + supplied);
    return supplied;
}

/**
 * Gets the value of a path input
 * It will be quoted for you if it isn't already and contains spaces
 * If required is true and the value is not set, it will throw.
 * If check is true and the path does not exist, it will throw.
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
 * If the url was not set and is not optional, it will throw.
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

/*
 * Gets the endpoint data parameter value with specified key for a service endpoint
 * If the endpoint data parameter was not set and is not optional, it will throw.
 *
 * @param id name of the service endpoint
 * @param key of the parameter
 * @param optional whether the endpoint data is optional
 * @returns {string} value of the endpoint data parameter
 */
export function getEndpointDataParameter(id: string, key: string, optional: boolean): string {
    var dataParamVal = process.env['ENDPOINT_DATA_' + id + '_' + key.toUpperCase()];

    if(!optional && !dataParamVal) {
        throw new Error(loc('LIB_EndpointDataNotExist', id, key));
    }

    debug(id + ' data ' + key + ' = ' + dataParamVal);
    return dataParamVal;
}

/**
 * Gets the endpoint authorization scheme for a service endpoint
 * If the endpoint authorization scheme is not set and is not optional, it will throw.
 *
 * @param id name of the service endpoint
 * @param optional whether the endpoint authorization scheme is optional
 * @returns {string} value of the endpoint authorization scheme
 */
export function getEndpointAuthorizationScheme(id: string, optional: boolean) : string {
    var authScheme = _vault.retrieveSecret('ENDPOINT_AUTH_SCHEME_' + id);

    if(!optional && !authScheme) {
        throw new Error(loc('LIB_EndpointAuthNotExist', id));
    }

    debug(id + ' auth scheme = ' + authScheme);
    return authScheme;
}

/**
 * Gets the endpoint authorization parameter value for a service endpoint with specified key
 * If the endpoint authorization parameter is not set and is not optional, it will throw.
 *
 * @param id name of the service endpoint
 * @param key key to find the endpoint authorization parameter
 * @param optional optional whether the endpoint authorization scheme is optional
 * @returns {string} value of the endpoint authorization parameter value
 */
export function getEndpointAuthorizationParameter(id: string, key: string, optional: boolean) : string {
    var authParam = _vault.retrieveSecret('ENDPOINT_AUTH_PARAMETER_' + id + '_' + key.toUpperCase());

    if(!optional && !authParam) {
        throw new Error(loc('LIB_EndpointAuthNotExist', id));
    }

    debug(id + ' auth param ' + key + ' = ' + authParam);
    return authParam;
}
/**
 * Interface for EndpointAuthorization
 * Contains a schema and a string/string dictionary of auth data
 */
export interface EndpointAuthorization {
    /** dictionary of auth data */
    parameters: {
        [key: string]: string;
    };

    /** auth scheme such as OAuth or username/password etc... */
    scheme: string;
}

/**
 * Gets the authorization details for a service endpoint
 * If the authorization was not set and is not optional, it will throw.
 * 
 * @param     id        name of the service endpoint
 * @param     optional  whether the url is optional
 * @returns   string
 */
export function getEndpointAuthorization(id: string, optional: boolean): EndpointAuthorization {
    var aval = _vault.retrieveSecret('ENDPOINT_AUTH_' + id);

    if (!optional && !aval) {
        setResult(TaskResult.Failed, loc('LIB_EndpointAuthNotExist', id));
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
function _checkShell(cmd: string, continueOnError?: boolean) {
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
    var exist = false;
    try {
        exist = path && fs.statSync(path) != null;
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            exist = false;
        } else {
            throw err;
        }
    }
    return exist;
}

export interface FsOptions {
  encoding?: string;
  mode?: number;
  flag?: string;
}

export function writeFile(file: string, data: string|Buffer, options? : string|FsOptions) {
    fs.writeFileSync(file, data, options);
}

/**
 * Useful for determining the host operating system.
 * see [os.type](https://nodejs.org/api/os.html#os_os_type)
 * 
 * @return      the name of the operating system
 */
export function osType(): string {
    return os.type();
}

/**
 * Returns the process's current working directory.
 * see [process.cwd](https://nodejs.org/api/process.html#process_process_cwd)
 * 
 * @return      the path to the current working directory of the process
 */
export function cwd() : string {
    return process.cwd();
}

/**
 * Checks whether a path exists.
 * If the path does not exist, it will throw.
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
        _checkShell('cd');
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
    _checkShell('pushd');
}

/**
 * Change working directory back to previously pushed directory
 * 
 * @returns   void
 */
export function popd(): void {
    shell.popd();
    _checkShell('popd');
}

/**
 * Make a directory.  Creates the full path with folders in between
 * Will throw if it fails
 * 
 * @param     p       path to create
 * @returns   void
 */
export function mkdirP(p: string): void {
    if (!p) {
        throw new Error(loc('LIB_ParameterIsRequired', 'p'));
    }

    // build a stack of directories to create
    let stack: string[] = [ ];
    let testDir: string = p;
    while (true) {
        // validate the loop is not out of control
        if (stack.length >= (process.env['TASKLIB_TEST_MKDIRP_FAILSAFE'] || 1000)) {
            // let the framework throw
            debug('loop is out of control');
            fs.mkdirSync(p);
            return;
        }

        debug(`testing directory '${testDir}'`);
        let stats: fs.Stats;
        try {
            stats = fs.statSync(testDir);
        } catch (err) {
            if (err.code == 'ENOENT') {
                // validate the directory is not the drive root
                let parentDir = path.dirname(testDir);
                if (testDir == parentDir) {
                    throw new Error(loc('LIB_MkdirFailedInvalidDriveRoot', p, testDir)); // Unable to create directory '{p}'. Root directory does not exist: '{testDir}'
                }

                // push the dir and test the parent
                stack.push(testDir);
                testDir = parentDir;
                continue;
            }
            else if (err.code == 'UNKNOWN') {
                throw new Error(loc('LIB_MkdirFailedInvalidShare', p, testDir)) // Unable to create directory '{p}'. Unable to verify the directory exists: '{testDir}'. If directory is a file share, please verify the share name is correct, the share is online, and the current process has permission to access the share.
            }
            else {
                throw err;
            }
        }

        if (!stats.isDirectory()) {
            throw new Error(loc('LIB_MkdirFailedFileExists', p, testDir)); // Unable to create directory '{p}'. Conflicting file exists: '{testDir}'
        }

        // testDir exists
        break;
    }

    // create each directory
    while (stack.length) {
        let dir = stack.pop();
        debug(`mkdir '${dir}'`);
        try {
            fs.mkdirSync(dir);
        } catch (err) {
            throw new Error(loc('LIB_MkdirFailed', p, err.message)); // Unable to create directory '{p}'. {err.message}
        }
    }
}

/**
 * Resolves a sequence of paths or path segments into an absolute path.
 * Calls node.js path.resolve()
 * Allows L0 testing with consistent path formats on Mac/Linux and Windows in the mock implementation
 * @param pathSegments
 * @returns {string}
 */
export function resolve(...pathSegments: any[]): string {
    var absolutePath = path.resolve.apply(this, pathSegments);
    debug('Absolute path for pathSegments: ' + pathSegments + ' = ' + absolutePath);
    return absolutePath;
}

/**
 * Returns path of a tool had the tool actually been invoked.  Resolves via paths.
 * If you check and the tool does not exist, it will throw.
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
                pathArray.forEach(function (dir) {
                    if (toolPath)
                        return; // already found it

                    var attempt = resolve(dir + '/' + tool);

                    var baseAttempt = attempt;
                    attempt = baseAttempt + '.exe';
                    if (exist(attempt) && stats(attempt).isFile) {
                        toolPath = attempt;
                        return;
                    }
                    attempt = baseAttempt + '.bat';
                    if (exist(attempt) && stats(attempt).isFile) {
                        toolPath = attempt;
                        return;
                    }
                    attempt = baseAttempt + '.cmd';
                    if (exist(attempt) && stats(attempt).isFile) {
                        toolPath = attempt;
                        return;
                    }
                });
            }

            // Command not found in Path, but the input itself is point to a file.
            if (!toolPath && exist(tool) && stats(tool).isFile) {
                toolPath = resolve(tool);
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
 * Returns array of files in the given path, or in current directory if no path provided.  See shelljs.ls
 * @param  {string}   options  Available options: -R (recursive), -A (all files, include files beginning with ., except for . and ..)
 * @param  {string[]} paths    Paths to search.
 * @return {string[]}          An array of files in the given path(s).
 */
export function ls(options: string, paths: string[]): string[] {
    if(options){
        return shell.ls(options, paths);
    } else {
        return shell.ls(paths);
    }
}

/**
 * Copies a file or folder.
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

    _checkShell('cp', continueOnError);
}

/**
 * Moves a path.
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

    _checkShell('mv', continueOnError);
}

/**
 * Interface for FindOptions
 * Contains properties to control whether to follow symlinks
 */
export interface FindOptions {
    /**
     * Equivalent to the -H command line option. Indicates whether to traverse descendants if
     * the specified path is a symbolic link directory. Does not cause nested symbolic link
     * directories to be traversed.
     */
    followSpecifiedSymbolicLink: boolean;

    /**
     * Equivalent to the -L command line option. Indicates whether to traverse descendants of
     * symbolic link directories.
     */
    followSymbolicLinks: boolean;
}

/**
 * Recursively finds all paths a given path. Returns an array of paths.
 *
 * @param     findPath  path to search
 * @param     options   optional. defaults to { followSymbolicLinks: true }. following soft links is generally appropriate unless deleting files.
 * @returns   string[]
 */
export function find(findPath: string, options?: FindOptions): string[] {
    if (!findPath) {
        debug('no path specified');
        return [];
    }

    // normalize the path, otherwise the first result is inconsistently formatted from the rest of the results
    // because path.join() performs normalization.
    findPath = path.normalize(findPath);

    // debug trace the parameters
    debug(`findPath: '${findPath}'`);
    options = options || _getDefaultFindOptions();
    _debugFindOptions(options)

    // return empty if not exists
    try {
        fs.lstatSync(findPath);
    }
    catch (err) {
        if (err.code == 'ENOENT') {
            debug('0 results')
            return [];
        }

        throw err;
    }

    try {
        let result: string[] = [];

        // push the first item
        let stack: _FindItem[] = [ new _FindItem(findPath, 1) ];
        let traversalChain: string[] = []; // used to detect cycles

        while (stack.length) {
            // pop the next item and push to the result array
            let item: _FindItem = stack.pop();
            result.push(item.path);

            // stat the item.  the stat info is used further below to determine whether to traverse deeper
            //
            // stat returns info about the target of a symlink (or symlink chain),
            // lstat returns info about a symlink itself
            let stats: fs.Stats;
            if (options.followSymbolicLinks) {
                // use stat (following all symlinks)
                stats = fs.statSync(item.path);
            }
            else if (options.followSpecifiedSymbolicLink && result.length == 1) {
                // use stat (following symlinks for the specified path and this is the specified path)
                stats = fs.statSync(item.path);
            }
            else {
                // use lstat (not following symlinks)
                stats = fs.lstatSync(item.path);
            }

            // note, isDirectory() returns false for the lstat of a symlink
            if (stats.isDirectory()) {
                debug(`  ${item.path} (directory)`);

                if (options.followSymbolicLinks) {
                    // get the realpath
                    let realPath: string = fs.realpathSync(item.path);

                    // fixup the traversal chain to match the item level
                    while (traversalChain.length >= item.level) {
                        traversalChain.pop();
                    }

                    // test for a cycle
                    if (traversalChain.some((x: string) => x == realPath)) {
                        debug('    cycle detected');
                        continue;
                    }

                    // update the traversal chain
                    traversalChain.push(realPath);
                }

                // push the child items in reverse onto the stack
                let childLevel: number = item.level + 1;
                let childItems: _FindItem[] =
                    fs.readdirSync(item.path)
                    .map((childName: string) => new _FindItem(path.join(item.path, childName), childLevel));
                stack.push(...childItems.reverse());
            }
            else {
                debug(`  ${item.path} (file)`);
            }
        }

        debug(`${result.length} results`);
        return result;
    }
    catch (err) {
        throw new Error(loc('LIB_OperationFailed', 'find', err.message));
    }
}

class _FindItem {
    public path: string;
    public level: number;

    public constructor(path: string, level: number) {
        this.path = path;
        this.level = level;
    }
}

function _debugFindOptions(options: FindOptions): void {
    debug(`findOptions.followSpecifiedSymbolicLink: '${options.followSpecifiedSymbolicLink}'`);
    debug(`findOptions.followSymbolicLinks: '${options.followSymbolicLinks}'`);
}

function _getDefaultFindOptions(): FindOptions {
    return <FindOptions>{
        followSpecifiedSymbolicLink: true,
        followSymbolicLinks: true
    };
}

/**
 * Prefer tl.find() and tl.match() instead. This function is for backward compatibility
 * when porting tasks to Node from the PowerShell or PowerShell3 execution handler.
 *
 * @param    rootDirectory      path to root unrooted patterns with
 * @param    pattern            include and exclude patterns
 * @param    includeFiles       whether to include files in the result. defaults to true when includeFiles and includeDirectories are both false
 * @param    includeDirectories whether to include directories in the result
 * @returns  string[]
 */
export function legacyFindFiles(
        rootDirectory: string,
        pattern: string,
        includeFiles?: boolean,
        includeDirectories?: boolean): string[] {

    if (!pattern) {
        throw new Error('pattern parameter cannot be empty');
    }

    debug(`legacyFindFiles rootDirectory: '${rootDirectory}'`);
    debug(`pattern: '${pattern}'`);
    debug(`includeFiles: '${includeFiles}'`);
    debug(`includeDirectories: '${includeDirectories}'`);
    if (!includeFiles && !includeDirectories) {
        includeFiles = true;
    }

    // organize the patterns into include patterns and exclude patterns
    let includePatterns: string[] = [];
    let excludePatterns: RegExp[] = [];
    pattern = pattern.replace(/;;/g, '\0');
    for (let pat of pattern.split(';')) {
        if (!pat) {
            continue;
        }

        pat = pat.replace(/\0/g, ';');

        // determine whether include pattern and remove any include/exclude prefix.
        // include patterns start with +: or anything other than -:
        // exclude patterns start with -:
        let isIncludePattern: boolean;
        if (_startsWith(pat, '+:')) {
            pat = pat.substring(2);
            isIncludePattern = true;
        }
        else if (_startsWith(pat, '-:')) {
            pat = pat.substring(2);
            isIncludePattern = false;
        }
        else {
            isIncludePattern = true;
        }

        // validate pattern does not end with a slash
        if (_endsWith(pat, '/') || (process.platform == 'win32' && _endsWith(pat, '\\'))) {
            throw new Error(loc('LIB_InvalidPattern', pat));
        }

        // root the pattern
        if (rootDirectory && !path.isAbsolute(pat)) {
            pat = path.join(rootDirectory, pat);

            // remove trailing slash sometimes added by path.join() on Windows, e.g.
            //      path.join('\\\\hello', 'world') => '\\\\hello\\world\\'
            //      path.join('//hello', 'world') => '\\\\hello\\world\\'
            if (_endsWith(pat, '\\')) {
                pat = pat.substring(0, pat.length - 1);
            }
        }

        if (isIncludePattern) {
            includePatterns.push(pat);
        }
        else {
            excludePatterns.push(_legacyFindFiles_convertPatternToRegExp(pat));
        }
    }

    // find and apply patterns
    let count = 0;
    let result: string[] = _legacyFindFiles_getMatchingItems(includePatterns, excludePatterns, !!includeFiles, !!includeDirectories);
    debug('all matches:');
    for (let resultItem of result) {
        debug(' ' + resultItem);
    }

    debug('total matched: ' + result.length);
    return result;
}

function _legacyFindFiles_convertPatternToRegExp(pattern: string): RegExp {
    pattern = (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern) // normalize separator on Windows
        .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') // regex escape - from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
        .replace(/\\\/\\\*\\\*\\\//g, '((\/.+/)|(\/))') // replace directory globstar, e.g. /hello/**/world
        .replace(/\\\*\\\*/g, '.*') // replace remaining globstars with a wildcard that can span directory separators, e.g. /hello/**dll
        .replace(/\\\*/g, '[^\/]*') // replace asterisks with a wildcard that cannot span directory separators, e.g. /hello/*.dll
        .replace(/\\\?/g, '[^\/]') // replace single character wildcards, e.g. /hello/log?.dll
    pattern = `^${pattern}$`;
    let flags = process.platform == 'win32' ? 'i' : '';
    return new RegExp(pattern, flags);
}
_internal._legacyFindFiles_convertPatternToRegExp = _legacyFindFiles_convertPatternToRegExp; // for unit testing

function _legacyFindFiles_getMatchingItems(
    includePatterns: string[],
    excludePatterns: RegExp[],
    includeFiles: boolean,
    includeDirectories: boolean) {

    debug('getMatchingItems()');
    for (let pattern of includePatterns) {
        debug(`includePattern: '${pattern}'`);
    }

    for (let pattern of excludePatterns) {
        debug(`excludePattern: ${pattern}`);
    }

    debug('includeFiles: ' + includeFiles);
    debug('includeDirectories: ' + includeDirectories);

    let allFiles = {} as { [k: string]: string };
    for (let pattern of includePatterns) {
        // determine the directory to search
        //
        // note, getDirectoryName removes redundant path separators
        let findPath: string;
        let starIndex = pattern.indexOf('*');
        let questionIndex = pattern.indexOf('?');
        if (starIndex < 0 && questionIndex < 0) {
            // if no wildcards are found, use the directory name portion of the path.
            // if there is no directory name (file name only in pattern or drive root),
            // this will return empty string.
            findPath = _getDirectoryName(pattern);
        }
        else {
            // extract the directory prior to the first wildcard
            let index = Math.min(
                starIndex >= 0 ? starIndex : questionIndex,
                questionIndex >= 0 ? questionIndex : starIndex);
            findPath = _getDirectoryName(pattern.substring(0, index));
        }

        // note, due to this short-circuit and the above usage of getDirectoryName, this
        // function has the same limitations regarding drive roots as the powershell
        // implementation.
        //
        // also note, since getDirectoryName eliminates slash redundancies, some additional
        // work may be required if removal of this limitation is attempted.
        if (!findPath) {
            continue;
        }

        let patternRegex: RegExp = _legacyFindFiles_convertPatternToRegExp(pattern);

        // find files/directories
        let items = find(findPath, <FindOptions>{ followSymbolicLinks: true })
            .filter((item: string) => {
                if (includeFiles && includeDirectories) {
                    return true;
                }

                let isDir = fs.statSync(item).isDirectory();
                return (includeFiles && !isDir) || (includeDirectories && isDir);
            })
            .forEach((item: string) => {
                let normalizedPath = process.platform == 'win32' ? item.replace(/\\/g, '/') : item; // normalize separators
                // **/times/** will not match C:/fun/times because there isn't a trailing slash
                // so try both if including directories
                let alternatePath = `${normalizedPath}/`;   // potential bug: it looks like this will result in a false
                                                            // positive if the item is a regular file and not a directory

                let isMatch = false;
                if (patternRegex.test(normalizedPath) || (includeDirectories && patternRegex.test(alternatePath))) {
                    isMatch = true;

                    // test whether the path should be excluded
                    for (let regex of excludePatterns) {
                        if (regex.test(normalizedPath) || (includeDirectories && regex.test(alternatePath))) {
                            isMatch = false;
                            break;
                        }
                    }
                }

                if (isMatch) {
                    allFiles[item] = item;
                }
            });
    }

    return Object.keys(allFiles).sort();
}

/**
 * Remove a path recursively with force
 * Returns whether it succeeds
 * 
 * @param     path     path to remove
 * @param     continueOnError optional. whether to continue on error
 * @returns   void
 */
export function rmRF(path: string): void {
    debug('rm -rf ' + path);

    // get the lstats in order to workaround a bug in shelljs@0.3.0 where symlinks
    // with missing targets are not handled correctly by "rm('-rf', path)"
    let lstats: fs.Stats;
    try {
        lstats = fs.lstatSync(path);
    }
    catch (err) {
        // if you try to delete a file that doesn't exist, desired result is achieved
        // other errors are valid
        if (err.code == 'ENOENT') {
            return;
        }

        throw new Error(loc('LIB_OperationFailed', 'rmRF', err.message));
    }

    if (lstats.isDirectory()) {
        debug('removing directory');
        shell.rm('-rf', path);
        let errMsg: string = shell.error();
        if (errMsg) {
            throw new Error(loc('LIB_OperationFailed', 'rmRF', errMsg));
        }

        return;
    }

    debug('removing file');
    try {
        fs.unlinkSync(path);
    }
    catch (err) {
        throw new Error(loc('LIB_OperationFailed', 'rmRF', err.message));
    }
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
    var tr: trm.ToolRunner = this.tool(toolPath);
    tr.on('debug', (data) => {
        debug(data);
    });

    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof (args) === 'string') {
            tr.line(args)
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
 * @param     options  optional exec options.  See IExecSyncOptions
 * @returns   IExecSyncResult
 */
export function execSync(tool: string, args: string | string[], options?: trm.IExecSyncOptions): trm.IExecSyncResult {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = this.tool(toolPath);
    tr.on('debug', (data) => {
        debug(data);
    });

    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof (args) === 'string') {
            tr.line(args)
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
export function tool(tool: string) {
    var tr: trm.ToolRunner = new trm.ToolRunner(tool);
    tr.on('debug', (message: string) => {
        debug(message);
    })

    return tr;
}

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------
// redefine to avoid folks having to typings install minimatch
export interface MatchOptions {
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    dot?: boolean;
    noext?: boolean;
    nocase?: boolean;
    nonull?: boolean;
    matchBase?: boolean;
    nocomment?: boolean;
    nonegate?: boolean;
    flipNegate?: boolean;
}

/**
 * Applies glob patterns to a list of paths. Supports interleaved exclude patterns.
 *
 * @param  list         array of paths
 * @param  patterns     patterns to apply. supports interleaved exclude patterns.
 * @param  patternRoot  optional. default root to apply to unrooted patterns. not applied to basename-only patterns when matchBase:true.
 * @param  options      optional. defaults to { dot: true, nobrace: true, nocase: process.platform == 'win32' }.
 */
export function match(list: string[], patterns: string[] | string, patternRoot?: string, options?: MatchOptions): string[] {
    // trace parameters
    debug(`patternRoot: '${patternRoot}'`);
    options = options || _getDefaultMatchOptions(); // default match options
    _debugMatchOptions(options);

    // convert pattern to an array
    if (typeof patterns == 'string') {
        patterns = [ patterns as string ];
    }

    // hashtable to keep track of matches
    let map: { [item: string]: boolean } = {};

    let originalOptions = options;
    for (let pattern of patterns) {
        debug(`pattern: '${pattern}'`);

        // trim and skip empty
        pattern = (pattern || '').trim();
        if (!pattern) {
            debug('skipping empty pattern');
            continue;
        }

        // clone match options
        let options = _cloneMatchOptions(originalOptions);

        // skip comments
        if (!options.nocomment && _startsWith(pattern, '#')) {
            debug('skipping comment');
            continue;
        }

        // set nocomment - brace expansion could result in a leading '#'
        options.nocomment = true;

        // determine whether pattern is include or exclude
        let negateCount = 0;
        if (!options.nonegate) {
            while (pattern.charAt(negateCount) == '!') {
                negateCount++;
            }

            pattern = pattern.substring(negateCount); // trim leading '!'
            if (negateCount) {
                debug(`trimmed leading '!'. pattern: '${pattern}'`);
            }
        }

        let isIncludePattern = negateCount == 0 ||
            (negateCount % 2 == 0 && !options.flipNegate) ||
            (negateCount % 2 == 1 && options.flipNegate);

        // set nonegate - brace expansion could result in a leading '!'
        options.nonegate = true;
        options.flipNegate = false;

        // expand braces - required to accurately root patterns
        let expanded: string[];
        let preExpanded: string = pattern;
        if (options.nobrace) {
            expanded = [ pattern ];
        }
        else {
            // convert slashes on Windows before calling braceExpand(). unfortunately this means braces cannot
            // be escaped on Windows, this limitation is consistent with current limitations of minimatch (3.0.3).
            debug('expanding braces');
            let convertedPattern = process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern;
            expanded = (minimatch as any).braceExpand(convertedPattern);
        }

        // set nobrace
        options.nobrace = true;

        for (let pattern of expanded) {
            if (expanded.length != 1 || pattern != preExpanded) {
                debug(`pattern: '${pattern}'`);
            }

            // trim and skip empty
            pattern = (pattern || '').trim();
            if (!pattern) {
                debug('skipping empty pattern');
                continue;
            }

            // root the pattern when all of the following conditions are true:
            if (patternRoot &&          // patternRoot supplied
                !_isRooted(pattern) &&  // AND pattern not rooted
                                        // AND matchBase:false or not basename only
                (!options.matchBase || (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern).indexOf('/') >= 0)) {

                pattern = _ensureRooted(patternRoot, pattern);
                debug(`rooted pattern: '${pattern}'`);
            }

            if (isIncludePattern) {
                // apply the pattern
                debug('applying include pattern against original list');
                let matchResults: string[] = minimatch.match(list, pattern, options);
                debug(matchResults.length + ' matches');

                // union the results
                for (let matchResult of matchResults) {
                    map[matchResult] = true;
                }
            }
            else {
                // apply the pattern
                debug('applying exclude pattern against original list');
                let matchResults: string[] = minimatch.match(list, pattern, options);
                debug(matchResults.length + ' matches');

                // substract the results
                for (let matchResult of matchResults) {
                    delete map[matchResult];
                }
            }
        }
    }

    // return a filtered version of the original list (preserves order and prevents duplication)
    let result: string[] = list.filter((item: string) => map.hasOwnProperty(item));
    debug(result.length + ' final results');
    return result;
}

/**
 * Filter to apply glob patterns
 *
 * @param  pattern  pattern to apply
 * @param  options  optional. defaults to { dot: true, nobrace: true, nocase: process.platform == 'win32' }.
 */
export function filter(pattern: string, options?: MatchOptions): (element: string, indexed: number, array: string[]) => boolean {
    options = options || _getDefaultMatchOptions();
    return minimatch.filter(pattern, options);
}

function _cloneMatchOptions(matchOptions: MatchOptions): MatchOptions {
    return <MatchOptions>{
        debug: matchOptions.debug,
        nobrace: matchOptions.nobrace,
        noglobstar: matchOptions.noglobstar,
        dot: matchOptions.dot,
        noext: matchOptions.noext,
        nocase: matchOptions.nocase,
        nonull: matchOptions.nonull,
        matchBase: matchOptions.matchBase,
        nocomment: matchOptions.nocomment,
        nonegate: matchOptions.nonegate,
        flipNegate: matchOptions.flipNegate
    };
}

function _debugMatchOptions(options: MatchOptions): void {
    debug(`matchOptions.debug: '${options.debug}'`);
    debug(`matchOptions.nobrace: '${options.nobrace}'`);
    debug(`matchOptions.noglobstar: '${options.noglobstar}'`);
    debug(`matchOptions.dot: '${options.dot}'`);
    debug(`matchOptions.noext: '${options.noext}'`);
    debug(`matchOptions.nocase: '${options.nocase}'`);
    debug(`matchOptions.nonull: '${options.nonull}'`);
    debug(`matchOptions.matchBase: '${options.matchBase}'`);
    debug(`matchOptions.nocomment: '${options.nocomment}'`);
    debug(`matchOptions.nonegate: '${options.nonegate}'`);
    debug(`matchOptions.flipNegate: '${options.flipNegate}'`);
}

function _getDefaultMatchOptions(): MatchOptions {
    return <MatchOptions>{
        debug: false,
        nobrace: true,
        noglobstar: false,
        dot: true,
        noext: false,
        nocase: process.platform == 'win32',
        nonull: false,
        matchBase: false,
        nocomment: false,
        nonegate: false,
        flipNegate: false
    };
}

/**
 * Determines the find root from a list of patterns. Performs the find and then applies the glob patterns.
 * Supports interleaved exclude patterns. Unrooted patterns are rooted using defaultRoot, unless
 * matchOptions.matchBase is specified and the pattern is a basename only. For matchBase cases, the
 * defaultRoot is used as the find root.
 *
 * @param  defaultRoot   default path to root unrooted patterns. falls back to System.DefaultWorkingDirectory or process.cwd().
 * @param  patterns      pattern or array of patterns to apply
 * @param  findOptions   defaults to { followSymbolicLinks: true }. following soft links is generally appropriate unless deleting files.
 * @param  matchOptions  defaults to { dot: true, nobrace: true, nocase: process.platform == 'win32' }
 */
export function findMatch(defaultRoot: string, patterns: string[] | string, findOptions?: FindOptions, matchOptions?: MatchOptions) : string[] {

    // apply defaults for parameters and trace
    defaultRoot = defaultRoot || this.getVariable('system.defaultWorkingDirectory') || process.cwd();
    debug(`defaultRoot: '${defaultRoot}'`);
    patterns = patterns || [];
    patterns = typeof patterns == 'string' ? [ patterns ] as string[] : patterns;
    findOptions = findOptions || _getDefaultFindOptions();
    _debugFindOptions(findOptions);
    matchOptions = matchOptions || _getDefaultMatchOptions();
    _debugMatchOptions(matchOptions);

    // normalize slashes for root dir
    defaultRoot = _normalizeSeparators(defaultRoot);

    let results: { [key: string]: string } = { };
    let originalMatchOptions = matchOptions;
    for (let pattern of (patterns || [])) {
        debug(`pattern: '${pattern}'`);

        // trim and skip empty
        pattern = (pattern || '').trim();
        if (!pattern) {
            debug('skipping empty pattern');
            continue;
        }

        // clone match options
        let matchOptions = _cloneMatchOptions(originalMatchOptions);

        // skip comments
        if (!matchOptions.nocomment && _startsWith(pattern, '#')) {
            debug('skipping comment');
            continue;
        }

        // set nocomment - brace expansion could result in a leading '#'
        matchOptions.nocomment = true;

        // determine whether pattern is include or exclude
        let negateCount = 0;
        if (!matchOptions.nonegate) {
            while (pattern.charAt(negateCount) == '!') {
                negateCount++;
            }

            pattern = pattern.substring(negateCount); // trim leading '!'
            if (negateCount) {
                debug(`trimmed leading '!'. pattern: '${pattern}'`);
            }
        }

        let isIncludePattern = negateCount == 0 ||
            (negateCount % 2 == 0 && !matchOptions.flipNegate) ||
            (negateCount % 2 == 1 && matchOptions.flipNegate);

        // set nonegate - brace expansion could result in a leading '!'
        matchOptions.nonegate = true;
        matchOptions.flipNegate = false;

        // expand braces - required to accurately interpret findPath
        let expanded: string[];
        let preExpanded: string = pattern;
        if (matchOptions.nobrace) {
            expanded = [ pattern ];
        }
        else {
            // convert slashes on Windows before calling braceExpand(). unfortunately this means braces cannot
            // be escaped on Windows, this limitation is consistent with current limitations of minimatch (3.0.3).
            debug('expanding braces');
            let convertedPattern = process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern;
            expanded = (minimatch as any).braceExpand(convertedPattern);
        }

        // set nobrace
        matchOptions.nobrace = true;

        for (let pattern of expanded) {
            if (expanded.length != 1 || pattern != preExpanded) {
                debug(`pattern: '${pattern}'`);
            }

            // trim and skip empty
            pattern = (pattern || '').trim();
            if (!pattern) {
                debug('skipping empty pattern');
                continue;
            }

            if (isIncludePattern) {
                // determine the findPath
                let findInfo: _PatternFindInfo = _getFindInfoFromPattern(defaultRoot, pattern, matchOptions);
                let findPath: string = findInfo.findPath;
                debug(`findPath: '${findPath}'`);

                if (!findPath) {
                    debug('skipping empty path');
                    continue;
                }

                // perform the find
                debug(`statOnly: '${findInfo.statOnly}'`);
                let findResults: string[] = [];
                if (findInfo.statOnly) {
                    // simply stat the path - all path segments were used to build the path
                    try {
                        fs.statSync(findPath);
                        findResults.push(findPath);
                    }
                    catch (err) {
                        if (err.code != 'ENOENT') {
                            throw err;
                        }

                        debug('ENOENT');
                    }
                }
                else {
                    findResults = find(findPath, findOptions);
                }

                debug(`found ${findResults.length} paths`);

                // apply the pattern
                debug('applying include pattern');
                if (findInfo.adjustedPattern != pattern) {
                    debug(`adjustedPattern: '${findInfo.adjustedPattern}'`);
                    pattern = findInfo.adjustedPattern;
                }

                let matchResults: string[] = minimatch.match(findResults, pattern, matchOptions);
                debug(matchResults.length + ' matches');

                // union the results
                for (let matchResult of matchResults) {
                    let key = process.platform == 'win32' ? matchResult.toUpperCase() : matchResult;
                    results[key] = matchResult;
                }
            }
            else {
                // check if basename only and matchBase=true
                if (matchOptions.matchBase &&
                    !_isRooted(pattern) &&
                    (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern).indexOf('/') < 0) {

                    // do not root the pattern
                    debug('matchBase and basename only');
                }
                else {
                    // root the exclude pattern
                    pattern = _ensurePatternRooted(defaultRoot, pattern);
                    debug(`after ensurePatternRooted, pattern: '${pattern}'`);
                }

                // apply the pattern
                debug('applying exclude pattern');
                let matchResults: string[] = minimatch.match(
                    Object.keys(results).map((key: string) => results[key]),
                    pattern,
                    matchOptions);
                debug(matchResults.length + ' matches');

                // substract the results
                for (let matchResult of matchResults) {
                    let key = process.platform == 'win32' ? matchResult.toUpperCase() : matchResult;
                    delete results[key];
                }
            }
        }
    }

    let finalResult: string[] = Object.keys(results)
        .map((key: string) => results[key])
        .sort();
    debug(finalResult.length + ' final results');
    return finalResult;
}

interface _PatternFindInfo {
    /** Adjusted pattern to use. Unrooted patterns are typically rooted using the default info, although this is not true for match-base scenarios. */
    adjustedPattern: string,

    /** Path interpreted from the pattern to call find() on. */
    findPath: string,

    /** Indicates whether to call stat() or find(). When all path segemnts in the pattern are literal, there is no need to call find(). */
    statOnly: boolean,
}

function _getFindInfoFromPattern(defaultRoot: string, pattern: string, matchOptions: MatchOptions): _PatternFindInfo {
    // parameter validation
    if (!defaultRoot) {
        throw new Error('getFindRootFromPattern() parameter defaultRoot cannot be empty');
    }

    if (!pattern) {
        throw new Error('getFindRootFromPattern() parameter pattern cannot be empty');
    }

    if (!matchOptions.nobrace) {
        throw new Error('getFindRootFromPattern() expected matchOptions.nobrace to be true');
    }

    // for the sake of determining the findPath, pretend nocase=false
    matchOptions = _cloneMatchOptions(matchOptions);
    matchOptions.nocase = false;

    // check if basename only and matchBase=true
    if (matchOptions.matchBase &&
        !_isRooted(pattern) &&
        (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern).indexOf('/') < 0) {

        return <_PatternFindInfo>{
            adjustedPattern: pattern, // for basename only scenarios, do not root the pattern
            findPath: defaultRoot,
            statOnly: false,
        };
    }

    // the technique applied by this function is to use the information on the Minimatch object determine
    // the findPath. Minimatch breaks the pattern into path segments, and exposes information about which
    // segments are literal vs patterns.
    //
    // note, the technique currently imposes a limitation for drive-relative paths with a glob in the
    // first segment, e.g. C:hello*/world. it's feasible to overcome this limitation, but is left unsolved
    // for now.
    let minimatchObj = new minimatch.Minimatch(pattern, matchOptions);

    // the "set" property is an array of arrays of parsed path segment info. the outer array should only
    // contain one item, otherwise something went wrong. brace expansion can result in multiple arrays,
    // but that should be turned off by the time this function is reached.
    if (minimatchObj.set.length != 1) {
        throw new Error('getFindRootFromPattern() expected Minimatch(...).set.length to be 1. Actual: ' + minimatchObj.set.length);
    }

    let literalSegments: string[] = [];
    for (let parsedSegment of minimatchObj.set[0]) {
        if (typeof parsedSegment == 'string') {
            // the item is a string when the original input for the path segment does not contain any
            // unescaped glob characters.
            //
            // note, the string here is already unescaped (i.e. glob escaping removed), so it is ready
            // to pass to find() as-is. for example, an input string 'hello\\*world' => 'hello*world'.
            literalSegments.push(parsedSegment);
            continue;
        }

        break;
    }

    // join the literal segments back together. Minimatch converts '\' to '/' on Windows, then squashes
    // consequetive slashes, and finally splits on slash. this means that UNC format is lost, but can
    // be detected from the original pattern.
    let joinedSegments = literalSegments.join('/');
    if (joinedSegments && process.platform == 'win32' && _startsWith(pattern.replace(/\\/g, '/'), '//')) {
        joinedSegments = '/' + joinedSegments; // restore UNC format
    }

    // determine the find path
    let findPath: string;
    if (_isRooted(pattern)) { // the pattern was rooted
        findPath = joinedSegments;
    }
    else if (joinedSegments) { // the pattern was not rooted, and literal segments were found
        findPath = _ensureRooted(defaultRoot, joinedSegments);
    }
    else { // the pattern was not rooted, and no literal segments were found
        findPath = defaultRoot;
    }

    // clean up the path
    if (findPath) {
        findPath = _getDirectoryName(_ensureRooted(findPath, '_')); // hack to remove unnecessary trailing slash
        findPath = _normalizeSeparators(findPath); // normalize slashes
    }

    return <_PatternFindInfo>{
        adjustedPattern: _ensurePatternRooted(defaultRoot, pattern),
        findPath: findPath,
        statOnly: literalSegments.length == minimatchObj.set[0].length,
    };
}
_internal._getFindInfoFromPattern = _getFindInfoFromPattern;

function _ensurePatternRooted(root: string, p: string) {
    if (!root) {
        throw new Error('ensurePatternRooted() parameter "root" cannot be empty');
    }

    if (!p) {
        throw new Error('ensurePatternRooted() parameter "p" cannot be empty');
    }

    if (_isRooted(p)) {
        return p;
    }

    // normalize root
    root = _normalizeSeparators(root);

    // escape special glob characters
    root = (process.platform == 'win32' ? root : root.replace(/\\/g, '\\\\')) // escape '\' on OSX/Linux
        .replace(/(\[)(?=[^\/]+\])/g, '[[]') // escape '[' when ']' follows within the path segment
        .replace(/\?/g, '[?]') // escape '?'
        .replace(/\*/g, '[*]') // escape '*'
        .replace(/\+\(/g, '[+](') // escape '+('
        .replace(/@\(/g, '[@](') // escape '@('
        .replace(/!\(/g, '[!]('); // escape '!('

    return _ensureRooted(root, p);
}
_internal._ensurePatternRooted = _ensurePatternRooted;

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

// only exposed as a function so unit tests can reload vault for each test.
// in prod, it's called globally below so user does not need to call

function _loadData(): void {
    // in agent, workFolder is set.
    // In interactive dev mode, it won't be
    let keyPath: string = getVariable("agent.workFolder") || process.cwd();
    _vault = new vm.Vault(keyPath);
    _knownVariableMap = { };
    debug('loading inputs and endpoints');
    let loaded: number = 0;
    for (let envvar in process.env) {
        if (_startsWith(envvar, 'INPUT_') ||
            _startsWith(envvar, 'ENDPOINT_AUTH_') ||
            _startsWith(envvar, 'SECRET_')) {

            // Record the secret variable metadata. This is required by getVariable to know whether
            // to retrieve the value from the vault. In a 2.104.1 agent or higher, this metadata will
            // be overwritten when the VSTS_SECRET_VARIABLES env var is processed below.
            if (_startsWith(envvar, 'SECRET_')) {
                let variableName: string = envvar.substring('SECRET_'.length);
                if (variableName) {
                    // This is technically not the variable name (has underscores instead of dots),
                    // but it's good enough to make getVariable work in a pre-2.104.1 agent where
                    // the VSTS_SECRET_VARIABLES env var is not defined.
                    _knownVariableMap[_getVariableKey(variableName)] = <_KnownVariableInfo>{ name: variableName, secret: true };
                }
            }

            // store the secret
            if (process.env[envvar]) {
                ++loaded;
                debug('loading ' + envvar);
                _vault.storeSecret(envvar, process.env[envvar]);
                delete process.env[envvar];
            }
        }
    }
    debug('loaded ' + loaded);

    // store public variable metadata
    let names: string[];
    try {
        names = JSON.parse(process.env['VSTS_PUBLIC_VARIABLES'] || '[]');
    }
    catch (err) {
        throw new Error('Failed to parse VSTS_PUBLIC_VARIABLES as JSON. ' + err); // may occur during interactive testing
    }

    names.forEach((name: string) => {
        _knownVariableMap[_getVariableKey(name)] = <_KnownVariableInfo>{ name: name, secret: false };
    });
    delete process.env['VSTS_PUBLIC_VARIABLES'];

    // store secret variable metadata
    try {
        names = JSON.parse(process.env['VSTS_SECRET_VARIABLES'] || '[]');
    }
    catch (err) {
        throw new Error('Failed to parse VSTS_SECRET_VARIABLES as JSON. ' + err); // may occur during interactive testing
    }

    names.forEach((name: string) => {
        _knownVariableMap[_getVariableKey(name)] = <_KnownVariableInfo>{ name: name, secret: true };
    });
    delete process.env['VSTS_SECRET_VARIABLES'];
}
_internal._loadData = _loadData;
_loadData();

//--------------------------------------------------------------------------------
// Internal path helpers.
//--------------------------------------------------------------------------------
function _ensureRooted(root: string, p: string) {
    if (!root) {
        throw new Error('ensureRooted() parameter "root" cannot be empty');
    }

    if (!p) {
        throw new Error('ensureRooted() parameter "p" cannot be empty');
    }

    if (_isRooted(p)) {
        return p;
    }

    if (process.platform == 'win32' && root.match(/^[A-Z]:$/i)) { // e.g. C:
        return root + p;
    }

    // ensure root ends with a separator
    if (_endsWith(root, '/') || (process.platform == 'win32' && _endsWith(root, '\\'))) {
        // root already ends with a separator
    }
    else {
        root += path.sep; // append separator
    }

    return root + p;
}
_internal._ensureRooted = _ensureRooted;

/**
 * Determines the parent path and trims trailing slashes (when safe). Path separators are normalized
 * in the result. This function works similar to the .NET System.IO.Path.GetDirectoryName() method.
 * For example, C:\hello\world\ returns C:\hello\world (trailing slash removed). Returns empty when
 * no higher directory can be determined.
 */
function _getDirectoryName(p: string): string {
    // short-circuit if empty
    if (!p) {
        return '';
    }

    // normalize separators
    p = _normalizeSeparators(p);

    // on Windows, the goal of this function is to match the behavior of
    // [System.IO.Path]::GetDirectoryName(), e.g.
    //      C:/             =>
    //      C:/hello        => C:\
    //      C:/hello/       => C:\hello
    //      C:/hello/world  => C:\hello
    //      C:/hello/world/ => C:\hello\world
    //      C:              =>
    //      C:hello         => C:
    //      C:hello/        => C:hello
    //      /               =>
    //      /hello          => \
    //      /hello/         => \hello
    //      //hello         =>
    //      //hello/        =>
    //      //hello/world   =>
    //      //hello/world/  => \\hello\world
    //
    // unfortunately, path.dirname() can't simply be used. for example, on Windows
    // it yields different results from Path.GetDirectoryName:
    //      C:/             => C:/
    //      C:/hello        => C:/
    //      C:/hello/       => C:/
    //      C:/hello/world  => C:/hello
    //      C:/hello/world/ => C:/hello
    //      C:              => C:
    //      C:hello         => C:
    //      C:hello/        => C:
    //      /               => /
    //      /hello          => /
    //      /hello/         => /
    //      //hello         => /
    //      //hello/        => /
    //      //hello/world   => //hello/world
    //      //hello/world/  => //hello/world/
    //      //hello/world/again => //hello/world/
    //      //hello/world/again/ => //hello/world/
    //      //hello/world/again/again => //hello/world/again
    //      //hello/world/again/again/ => //hello/world/again
    if (process.platform == 'win32') {
        if (/^[A-Z]:\\?[^\\]+$/i.test(p)) { // e.g. C:\hello or C:hello
            return p.charAt(2) == '\\' ? p.substring(0, 3) : p.substring(0, 2);
        }
        else if (/^[A-Z]:\\?$/i.test(p)) { // e.g. C:\ or C:
            return '';
        }

        let lastSlashIndex = p.lastIndexOf('\\');
        if (lastSlashIndex < 0) { // file name only
            return '';
        }
        else if (p == '\\') { // relative root
            return '';
        }
        else if (lastSlashIndex == 0) { // e.g. \\hello
            return '\\';
        }
        else if (/^\\\\[^\\]+(\\[^\\]*)?$/.test(p)) { // UNC root, e.g. \\hello or \\hello\ or \\hello\world
            return '';
        }

        return p.substring(0, lastSlashIndex);  // e.g. hello\world => hello or hello\world\ => hello\world
                                                // note, this means trailing slashes for non-root directories
                                                // (i.e. not C:\, \, or \\unc\) will simply be removed.
    }

    // OSX/Linux
    if (p.indexOf('/') < 0) { // file name only
        return '';
    }
    else if (p == '/') {
        return '';
    }
    else if (_endsWith(p, '/')) {
        return p.substring(0, p.length - 1);
    }

    return path.dirname(p);
}
_internal._getDirectoryName = _getDirectoryName;

/**
 * On OSX/Linux, true if path starts with '/'. On Windows, true for paths like:
 * \, \hello, \\hello\share, C:, and C:\hello (and corresponding alternate separator cases).
 */
function _isRooted(p: string): boolean {
    p = _normalizeSeparators(p);
    if (!p) {
        throw new Error('isRooted() parameter "p" cannot be empty');
    }

    if (process.platform == 'win32') {
        return _startsWith(p, '\\') || // e.g. \ or \hello or \\hello
            /^[A-Z]:/i.test(p);      // e.g. C: or C:\hello
    }

    return _startsWith(p, '/'); // e.g. /hello
}
_internal._isRooted = _isRooted;

function _normalizeSeparators(p: string): string {
    p = p || '';
    if (process.platform == 'win32') {
        // convert slashes on Windows
        p = p.replace(/\//g, '\\');

        // remove redundant slashes
        let isUnc = /^\\\\+[^\\]/.test(p); // e.g. \\hello
        return (isUnc ? '\\' : '') + p.replace(/\\\\+/g, '\\'); // preserve leading // for UNC
    }

    // remove redundant slashes
    return p.replace(/\/\/+/g, '/');
}
_internal._normalizeSeparators = _normalizeSeparators;