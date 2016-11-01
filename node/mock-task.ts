
import Q = require('q');
import path = require('path');
import fs = require('fs');
import os = require('os');
import util = require('util');
import task = require('./task');
import tcm = require('./taskcommand');
import trm = require('./mock-toolrunner');
import ma = require('./mock-answer');

let mock: ma.MockAnswers = new ma.MockAnswers();

export function setAnswers(answers: ma.TaskLibAnswers) {
    mock.initialize(answers);
    trm.setAnswers(answers);
}

export enum TaskResult {
    Succeeded = 0,
    Failed = 1
}

//-----------------------------------------------------
// String convenience
//-----------------------------------------------------

function startsWith(str: string, start: string): boolean {
    return str.slice(0, start.length) == start;
}

function endsWith(str: string, start: string): boolean {
    return str.slice(-str.length) == str;
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
// Results and Exiting
//-----------------------------------------------------
module.exports.setResult = task.setResult;

//
// Catching all exceptions
//
process.on('uncaughtException', (err) => {
    module.exports.setResult(TaskResult.Failed, 'Unhandled:' + err.message);
});

//-----------------------------------------------------
// Loc Helpers
//-----------------------------------------------------
export function setResourcePath(path: string): void {
    // nothing in mock
}

export function loc(key: string): string {
    return 'loc_mock_' + key;
}

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
module.exports.getVariable = task.getVariable;
module.exports.setVariable = task.setVariable;
module.exports.getInput = task.getInput;
module.exports.getBoolInput = task.getBoolInput;
module.exports.setEnvVar = task.setEnvVar;
module.exports.getDelimitedInput = task.getDelimitedInput;
module.exports.filePathSupplied = task.filePathSupplied;

function getPathInput(name, required, check) {
    var inval = module.exports.getInput(name, required);
    if (inval) {
        if (check) {
            checkPath(inval, name);
        }
    }
    return inval;
}
module.exports.getPathInput = getPathInput;

//-----------------------------------------------------
// Endpoint Helpers
//-----------------------------------------------------
module.exports.getEndpointUrl = task.getEndpointUrl;
module.exports.getEndpointDataParameter = task.getEndpointDataParameter;
module.exports.getEndpointAuthorizationScheme = task.getEndpointAuthorizationScheme;
module.exports.getEndpointAuthorizationParameter = task.getEndpointAuthorizationParameter;
module.exports.getEndpointAuthorization = task.getEndpointAuthorization;

// TODO: should go away when task lib 
export interface EndpointAuthorization {
    parameters: {
        [key: string]: string;
    };
    scheme: string;
}

//-----------------------------------------------------
// Fs Helpers
//-----------------------------------------------------

export class FsStats implements fs.Stats {
    private m_isFile: boolean;
    private m_isDirectory: boolean;
    private m_isBlockDevice: boolean;
    private m_isCharacterDevice: boolean;
    private m_isSymbolicLink: boolean;
    private m_isFIFO: boolean;
    private m_isSocket: boolean;

    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;

    setAnswers(mockResponses) {
        this.m_isFile = mockResponses['isFile'] || false;
        this.m_isDirectory = mockResponses['isDirectory'] || false;
        this.m_isBlockDevice = mockResponses['isBlockDevice'] || false;
        this.m_isCharacterDevice = mockResponses['isCharacterDevice'] || false;
        this.m_isSymbolicLink = mockResponses['isSymbolicLink'] || false;
        this.m_isFIFO = mockResponses['isFIFO'] || false;
        this.m_isSocket = mockResponses['isSocket'] || false;

        this.dev = mockResponses['dev'];
        this.ino = mockResponses['ino'];
        this.mode = mockResponses['mode'];
        this.nlink = mockResponses['nlink'];
        this.uid = mockResponses['uid'];
        this.gid = mockResponses['gid'];
        this.rdev = mockResponses['rdev'];
        this.size = mockResponses['size'];
        this.blksize = mockResponses['blksize'];
        this.blocks = mockResponses['blocks'];
        this.atime = mockResponses['atime'];
        this.mtime = mockResponses['mtime'];
        this.ctime = mockResponses['ctime'];
        this.m_isSocket = mockResponses['isSocket'];
    }

    isFile(): boolean {
        return this.m_isFile;
    }

    isDirectory(): boolean {
        return this.m_isDirectory;
    }

    isBlockDevice(): boolean {
        return this.m_isBlockDevice;
    }

    isCharacterDevice(): boolean {
        return this.m_isCharacterDevice;
    }

    isSymbolicLink(): boolean {
        return this.m_isSymbolicLink;
    }

    isFIFO(): boolean {
        return this.m_isFIFO;
    }

    isSocket(): boolean {
        return this.m_isSocket;
    }
}

export function stats(path: string): FsStats {
    var fsStats = new FsStats();
    fsStats.setAnswers(mock.getResponse('stats', path) || {});
    return fsStats;
}

export function exist(path: string): boolean {
    return mock.getResponse('exist', path) || false;
}

export interface FsOptions {
    encoding?:string;
    mode?:number;
    flag?:string;
}

export function writeFile(file: string, data: string|Buffer, options?: string|FsOptions) {
    //do nothing
}

export function osType(): string {
    return mock.getResponse('osType', 'osType');
}

export function cwd(): string {
    return mock.getResponse('cwd', 'cwd');
}

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
module.exports.command = task.command;
module.exports.warning = task.warning;
module.exports.error = task.error;
module.exports.debug = task.debug;

export function cd(path: string): void {
    // do nothing.  TODO: keep stack with asserts
}

export function pushd(path: string): void {
    // do nothing.  TODO: keep stack with asserts
}

export function popd(): void {
    // do nothing.  TODO: keep stack with asserts
}

//------------------------------------------------
// Validation Helpers
//------------------------------------------------

export function checkPath(p: string, name: string): void {
    module.exports.debug('check path : ' + p);
    if (!p || !mock.getResponse('checkPath', p)) {
        throw new Error('Not found ' + p);
    }
}

//-----------------------------------------------------
// Shell/File I/O Helpers
// Abstract these away so we can
// - default to good error handling
// - inject system.debug info
// - have option to switch internal impl (shelljs now)
//-----------------------------------------------------
export function mkdirP(p): void {
    module.exports.debug('creating path: ' + p);
}

export function resolve(): string {
    // we can't do ...param if we target ES6 and node 5.  This is what <=ES5 compiles down to.
    //return the posix implementation in the mock, so paths will be consistent when L0 tests are run on Windows or Mac/Linux
    var absolutePath = path.posix.resolve.apply(this, arguments);
    module.exports.debug('Absolute path for pathSegments: ' + arguments + ' = ' + absolutePath);
    return absolutePath;
}

export function which(tool: string, check?: boolean): string {
    var response = mock.getResponse('which', tool);
    if (check) {
        checkPath(response, tool);
    }
    return response;
}

export function ls(options: string, paths: string[]): string[] {
    var response = mock.getResponse('ls', paths[0]);
    if(!response){
        return [];
    }
    return response;
}

export function cp(source: string, dest: string): void {
    console.log('###copying###');
    module.exports.debug('copying ' + source + ' to ' + dest);
}

export function find(findPath: string): string[] {
    return mock.getResponse('find', findPath);
}

export function rmRF(path: string): void {
    module.exports.debug('rmRF ' + path);
    var response = mock.getResponse('rmRF', path);
    if (!response['success']) {
        module.exports.setResult(1, response['message']);
    }
}

export function mv(source: string, dest: string, force: boolean, continueOnError?: boolean): boolean {
    module.exports.debug('moving ' + source + ' to ' + dest);
    return true;
}

export function glob(pattern: string): string[] {
    module.exports.debug('glob ' + pattern);

    var matches: string[] = mock.getResponse('glob', pattern);
    module.exports.debug('found ' + matches.length + ' matches');

    if (matches.length > 0) {
        var m = Math.min(matches.length, 10);
        module.exports.debug('matches:');
        if (m == 10) {
            module.exports.debug('listing first 10 matches as samples');
        }

        for (var i = 0; i < m; i++) {
            module.exports.debug(matches[i]);
        }
    }

    return matches;
}

export function globFirst(pattern: string): string {
    module.exports.debug('globFirst ' + pattern);
    var matches = glob(pattern);

    if (matches.length > 1) {
        module.exports.warning('multiple workspace matches.  using first.');
    }

    module.exports.debug('found ' + matches.length + ' matches');

    return matches[0];
}

//-----------------------------------------------------
// Exec convenience wrapper
//-----------------------------------------------------
export function exec(tool: string, args: any, options?: trm.IExecOptions): Q.Promise<number> {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = this.tool(toolPath);
    if (args) {
        tr.arg(args);
    }
    return tr.exec(options);
}

export function execSync(tool: string, args: any, options?: trm.IExecOptions): trm.IExecResult {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = this.tool(toolPath);
    if (args) {
        tr.arg(args);
    }

    return tr.execSync(options);
}

export function tool(tool: string): trm.ToolRunner {
    var tr: trm.ToolRunner = new trm.ToolRunner(tool);
    tr.on('debug', (message: string) => {
        module.exports.debug(message);
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
export function match(list: string[], pattern: string, options?: MatchOptions): string[];
export function match(list: string[], patterns: string[], options?: MatchOptions): string[];
export function match(list: string[], pattern: any, options?: MatchOptions): string[] {
    return mock.getResponse('match', pattern) || [];
}

export function matchFile(list, pattern, options): string[] {
    return mock.getResponse('match', pattern) || [];
}

export function filter(pattern, options): (element: string, index: number, array: string[]) => boolean {
    var filterList: string[] = mock.getResponse('filter', pattern);
    if (filterList) {
        return (element, index, array) => (filterList.indexOf(element) !== -1);
    }
    // default back to the built-in behavior
    return task.filter(pattern, options);
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

        module.exports.command('results.publish', properties, '');
    }
}

//-----------------------------------------------------
// Code Coverage Publisher
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

        module.exports.command('codecoverage.publish', properties, "");        
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
        module.exports.command('codecoverage.enable', buildProps, "");
    }
}

//-----------------------------------------------------
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;
