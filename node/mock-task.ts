
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

module.exports.TaskResult = task.TaskResult;

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

module.exports.setStdStream = task.setStdStream;
module.exports.setErrStream = task.setErrStream;

//-----------------------------------------------------
// Results and Exiting
//-----------------------------------------------------

module.exports.setResult = task.setResult;

//-----------------------------------------------------
// Loc Helpers
//-----------------------------------------------------
export function setResourcePath(path: string): void {
    // nothing in mock
}

export function loc(key: string, ...args: any[]): string {
    let str: string = 'loc_mock_' + key;
    if (args.length) {
        str += ' ' + args.join(' ');
    }

    return str;
}

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
module.exports.getVariable = task.getVariable;
module.exports.setVariable = task.setVariable;
module.exports.getTaskVariable = task.getTaskVariable;
module.exports.setTaskVariable = task.setTaskVariable;
module.exports.getInput = task.getInput;
module.exports.getBoolInput = task.getBoolInput;
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
// SecureFile Helpers
//-----------------------------------------------------
module.exports.getSecureFileName = task.getSecureFileName;
module.exports.getSecureFileTicket = task.getSecureFileTicket;

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
    fsStats.setAnswers(mock.getResponse('stats', path, module.exports.debug) || {});
    return fsStats;
}

export function exist(path: string): boolean {
    return mock.getResponse('exist', path, module.exports.debug) || false;
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
    return mock.getResponse('osType', 'osType', module.exports.debug);
}

export function cwd(): string {
    return mock.getResponse('cwd', 'cwd', module.exports.debug);
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
    if (!p || !mock.getResponse('checkPath', p, module.exports.debug)) {
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
    var response = mock.getResponse('which', tool, module.exports.debug);
    if (check) {
        checkPath(response, tool);
    }
    return response;
}

export function ls(options: string, paths: string[]): string[] {
    var response = mock.getResponse('ls', paths[0], module.exports.debug);
    if(!response){
        return [];
    }
    return response;
}

export function cp(source: string, dest: string): void {
    module.exports.debug('###copying###');
    module.exports.debug('copying ' + source + ' to ' + dest);
}

export function find(findPath: string): string[] {
    return mock.getResponse('find', findPath, module.exports.debug);
}

export function rmRF(path: string): void {
    module.exports.debug('rmRF ' + path);
    var response = mock.getResponse('rmRF', path, module.exports.debug);
    if (!response['success']) {
        module.exports.setResult(1, response['message']);
    }
}

export function mv(source: string, dest: string, force: boolean, continueOnError?: boolean): boolean {
    module.exports.debug('moving ' + source + ' to ' + dest);
    return true;
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

export function execSync(tool: string, args: any, options?: trm.IExecSyncOptions): trm.IExecSyncResult {
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
module.exports.filter = task.filter;
module.exports.match = task.match;

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

export function findMatch(defaultRoot: string, patterns: string[] | string) : string[] {
    let responseKey: string = typeof patterns == 'object' ? (patterns as string[]).join('\n') : patterns as string;
    return mock.getResponse('findMatch', responseKey, module.exports.debug);
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

//-----------------------------------------------------
// Http Proxy Helper
//-----------------------------------------------------
export function getHttpProxyConfiguration(requestUrl?: string): task.ProxyConfiguration {
    return null;
}

//-----------------------------------------------------
// Http Certificate Helper
//-----------------------------------------------------
export function getHttpCertConfiguration(): task.CertConfiguration {
    return null
}