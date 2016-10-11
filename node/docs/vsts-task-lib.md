# VSTS-TASK-LIB TYPESCRIPT API
 
## Dependencies
A [cross platform agent](https://github.com/Microsoft/vso-agent) OR a TFS 2015 Update 2 Windows agent (or higher) is required to run a Node task end-to-end. However, an agent is not required for interactively testing the task.
 
## Importing
For now, the built vsts-task-lib (in _build) should be packaged with your task in a node_modules folder
 
The build generates a vsts-task-lib.d.ts file for use when compiling tasks
In the example below, it is in a folder named definitions above the tasks lib
 
```
/// <reference path="../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/task')
```
 
## [Release notes](releases.md)
 
<div id="index">
## Index
 
### Input Functions <a href="#InputFunctions">(v)</a>
 
<a href="#taskgetInput">getInput</a> <br/>
<a href="#taskgetBoolInput">getBoolInput</a> <br/>
<a href="#taskgetPathInput">getPathInput</a> <br/>
<a href="#taskfilePathSupplied">filePathSupplied</a> <br/>
<a href="#taskgetDelimitedInput">getDelimitedInput</a> <br/>
<a href="#taskgetVariable">getVariable</a> <br/>
<a href="#taskgetVariables">getVariables</a> <br/>
<a href="#tasksetVariable">setVariable</a> <br/>
 
### Execution <a href="#Execution">(v)</a>
 
<a href="#tasktool">tool</a> <br/>
<a href="#toolrunnerToolRunnerarg">ToolRunner.arg</a> <br/>
<a href="#toolrunnerToolRunnerline">ToolRunner.line</a> <br/>
<a href="#toolrunnerToolRunnerargIf">ToolRunner.argIf</a> <br/>
<a href="#toolrunnerToolRunnerpipeExecOutputToTool">ToolRunner.pipeExecOutputToTool</a> <br/>
<a href="#toolrunnerIExecOptions">IExecOptions</a> <br/>
<a href="#toolrunnerToolRunnerexec">ToolRunner.exec</a> <br/>
<a href="#toolrunnerToolRunnerexecSync">ToolRunner.execSync</a> <br/>
<a href="#toolrunnerIExecResult">IExecResult</a> <br/>
<a href="#taskexec">exec</a> <br/>
<a href="#taskexecSync">execSync</a> <br/>
<a href="#tasksetResult">setResult</a> <br/>
 
### Service Endpoints <a href="#ServiceEndpoints">(v)</a>
 
<a href="#taskgetEndpointUrl">getEndpointUrl</a> <br/>
<a href="#taskEndpointAuthorization">EndpointAuthorization</a> <br/>
<a href="#taskgetEndpointAuthorization">getEndpointAuthorization</a> <br/>
 
### Disk Functions <a href="#DiskFunctions">(v)</a>
 
<a href="#taskwhich">which</a> <br/>
<a href="#taskcheckPath">checkPath</a> <br/>
<a href="#taskexist">exist</a> <br/>
<a href="#taskcd">cd</a> <br/>
<a href="#taskcp">cp</a> <br/>
<a href="#taskmv">mv</a> <br/>
<a href="#taskmkdirP">mkdirP</a> <br/>
<a href="#taskFindOptions">FindOptions</a> <br/>
<a href="#taskfind">find</a> <br/>
<a href="#taskrmRF">rmRF</a> <br/>
<a href="#taskpushd">pushd</a> <br/>
<a href="#taskpopd">popd</a> <br/>
<a href="#taskresolve">resolve</a> <br/>
<a href="#taskstats">stats</a> <br/>
<a href="#taskwriteFile">writeFile</a> <br/>
 
### Localization <a href="#Localization">(v)</a>
 
<a href="#tasksetResourcePath">setResourcePath</a> <br/>
<a href="#taskloc">loc</a> <br/>
 
<br/>
<div id="InputFunctions">
## Input Functions
 
---
 
Functions for retrieving inputs for the task
<br/>
<div id="taskgetInput">
### task.getInput <a href="#index">(^)</a>
Gets the value of an input.  The value is also trimmed.
If required is true and the value is not set, it will throw.
```javascript
getInput(name:string, required?:boolean):string
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the input to get
required | boolean | whether input is required.  optional, defaults to false
 
<br/>
<div id="taskgetBoolInput">
### task.getBoolInput <a href="#index">(^)</a>
Gets the value of an input and converts to a bool.  Convenience.
If required is true and the value is not set, it will throw.
```javascript
getBoolInput(name:string, required?:boolean):boolean
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the bool input to get
required | boolean | whether input is required.  optional, defaults to false
 
<br/>
<div id="taskgetPathInput">
### task.getPathInput <a href="#index">(^)</a>
Gets the value of a path input
It will be quoted for you if it isn't already and contains spaces
If required is true and the value is not set, it will throw.
If check is true and the path does not exist, it will throw.
```javascript
getPathInput(name:string, required?:boolean, check?:boolean):string
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the input to get
required | boolean | whether input is required.  optional, defaults to false
check | boolean | whether path is checked.  optional, defaults to false
 
<br/>
<div id="taskfilePathSupplied">
### task.filePathSupplied <a href="#index">(^)</a>
Checks whether a path inputs value was supplied by the user
File paths are relative with a picker, so an empty path is the root of the repo.
Useful if you need to condition work (like append an arg) if a value was supplied
```javascript
filePathSupplied(name:string):boolean
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the path input to check
 
<br/>
<div id="taskgetDelimitedInput">
### task.getDelimitedInput <a href="#index">(^)</a>
Gets the value of an input and splits the value using a delimiter (space, comma, etc).
Empty values are removed.  This function is useful for splitting an input containing a simple
list of items - such as build targets.
IMPORTANT: Do not use this function for splitting additional args!  Instead use argString(), which
follows normal argument splitting rules and handles values encapsulated by quotes.
If required is true and the value is not set, it will throw.
```javascript
getDelimitedInput(name:string, delim:string, required?:boolean):string
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the input to get
delim | string | delimiter to split on
required | boolean | whether input is required.  optional, defaults to false
 
<br/>
<div id="taskgetVariable">
### task.getVariable <a href="#index">(^)</a>
Gets a variable value that is defined on the build/release definition or set at runtime.
```javascript
getVariable(name:string):string
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the variable to get
 
<br/>
<div id="taskgetVariables">
### task.getVariables <a href="#index">(^)</a>
Gets a snapshot of the current state of all job variables available to the task.
Requires a 2.104.1 agent or higher for full functionality.
```javascript
getVariables():VariableInfo[]
```
<br/>
<div id="tasksetVariable">
### task.setVariable <a href="#index">(^)</a>
Sets a variable which will be available to subsequent tasks as well.
```javascript
setVariable(name:string, val:string, secret:boolean):void
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the variable to set
val | string | value to set
secret | boolean | whether variable is secret.  optional, defaults to false
 
 
<br/>
<div id="Execution">
## Execution
 
---
 
Tasks typically execute a series of tools (cli) and set the result of the task based on the outcome of those
 
```javascript
/// <reference path="../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

try {
    var toolPath = tl.which('atool');
    var atool:tr.ToolRunner = tl.tool(toolPath).arg('--afile').line('arguments');
    var code: number = await tr.exec();
    console.log('rc=' + code);
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
}
```
<br/>
<div id="tasktool">
### task.tool <a href="#index">(^)</a>
Convenience factory to create a ToolRunner.
```javascript
tool(tool:string):ToolRunner
```
 
Param | Type | Description
--- | --- | ---
tool | string | path to tool to exec
 
<br/>
<div id="toolrunnerToolRunnerarg">
### toolrunner.ToolRunner.arg <a href="#index">(^)</a>
Add argument
Append an argument or an array of arguments
returns ToolRunner for chaining
```javascript
arg(val:string | string[]):ToolRunner
```
 
Param | Type | Description
--- | --- | ---
val | string or string[] | string cmdline or array of strings
 
<br/>
<div id="toolrunnerToolRunnerline">
### toolrunner.ToolRunner.line <a href="#index">(^)</a>
Append argument command line string
e.g. '"arg one" two -z' would append args[]=['arg one', 'two', '-z']
returns ToolRunner for chaining
```javascript
line(val:string):ToolRunner
```
 
Param | Type | Description
--- | --- | ---
val | string | string cmdline
 
<br/>
<div id="toolrunnerToolRunnerargIf">
### toolrunner.ToolRunner.argIf <a href="#index">(^)</a>
Add argument(s) if a condition is met
Wraps arg().  See arg for details
returns ToolRunner for chaining
```javascript
argIf(condition:any, val:any):this
```
 
Param | Type | Description
--- | --- | ---
condition | any | boolean condition
val | any | string cmdline or array of strings
 
<br/>
<div id="toolrunnerToolRunnerpipeExecOutputToTool">
### toolrunner.ToolRunner.pipeExecOutputToTool <a href="#index">(^)</a>
Pipe output of exec() to another tool
```javascript
pipeExecOutputToTool(tool:ToolRunner):ToolRunner
```
 
Param | Type | Description
--- | --- | ---
tool | ToolRunner |  - 
 
<br/>
<div id="toolrunnerIExecOptions">
### toolrunner.IExecOptions <a href="#index">(^)</a>
Interface for exec options
 
Property | Description
--- | ---
cwd | optional working directory.  defaults to current
env | optional envvar dictionary.  defaults to current processes env
silent | optional.  defaults to false
failOnStdErr | optional.  whether to fail if output to stderr.  defaults to false
ignoreReturnCode | optional.  defaults to failing on non zero.  ignore will not fail leaving it up to the caller

 
<br/>
<div id="toolrunnerToolRunnerexec">
### toolrunner.ToolRunner.exec <a href="#index">(^)</a>
Exec a tool.
Output will be streamed to the live console.
Returns promise with return code
```javascript
exec(options?:IExecOptions):Promise
```
 
Param | Type | Description
--- | --- | ---
options | IExecOptions | optional exec options.  See IExecOptions
 
<br/>
<div id="toolrunnerToolRunnerexecSync">
### toolrunner.ToolRunner.execSync <a href="#index">(^)</a>
Exec a tool synchronously.
Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
Appropriate for short running tools
Returns IExecResult with output and return code
```javascript
execSync(options?:IExecOptions):IExecResult
```
 
Param | Type | Description
--- | --- | ---
options | IExecOptions | optionalexec options.  See IExecOptions
 
<br/>
<div id="toolrunnerIExecResult">
### toolrunner.IExecResult <a href="#index">(^)</a>
Interface for exec results returned from synchronous exec functions
 
Property | Description
--- | ---
stdout | standard output
stderr | error output
code | return code
error | Error on failure

 
<br/>
<div id="taskexec">
### task.exec <a href="#index">(^)</a>
Exec a tool.  Convenience wrapper over ToolRunner to exec with args in one call.
Output will be streamed to the live console.
Returns promise with return code
```javascript
exec(tool:string, args:any, options?:IExecOptions):Promise
```
 
Param | Type | Description
--- | --- | ---
tool | string | path to tool to exec
args | any | an arg string or array of args
options | IExecOptions | optional exec options.  See IExecOptions
 
<br/>
<div id="taskexecSync">
### task.execSync <a href="#index">(^)</a>
Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
Appropriate for short running tools
Returns IExecResult with output and return code
```javascript
execSync(tool:string, args:string | string[], options?:IExecOptions):IExecResult
```
 
Param | Type | Description
--- | --- | ---
tool | string | path to tool to exec
args | string or string[] | an arg string or array of args
options | IExecOptions | optionalexec options.  See IExecOptions
 
<br/>
<div id="tasksetResult">
### task.setResult <a href="#index">(^)</a>
Sets the result of the task.
Execution will continue.
If not set, task will be Succeeded.
If multiple calls are made to setResult the most pessimistic call wins (Failed) regardless of the order of calls.
```javascript
setResult(result:TaskResult, message:string):void
```
 
Param | Type | Description
--- | --- | ---
result | TaskResult | TaskResult enum of Success or Failed.
message | string | A message which will be logged as an error issue if the result is Failed.
 
 
<br/>
<div id="ServiceEndpoints">
## Service Endpoints
 
---
 
Retrieve service endpoints and authorization details
<br/>
<div id="taskgetEndpointUrl">
### task.getEndpointUrl <a href="#index">(^)</a>
Gets the url for a service endpoint
If the url was not set and is not optional, it will throw.
```javascript
getEndpointUrl(id:string, optional:boolean):string
```
 
Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint
optional | boolean | whether the url is optional
 
<br/>
<div id="taskEndpointAuthorization">
### task.EndpointAuthorization <a href="#index">(^)</a>
Interface for EndpointAuthorization
Contains a schema and a string/string dictionary of auth data
 
Property | Description
--- | ---
parameters | string string dictionary of auth data
scheme | auth scheme such as OAuth or username/password etc...

 
<br/>
<div id="taskgetEndpointAuthorization">
### task.getEndpointAuthorization <a href="#index">(^)</a>
Gets the authorization details for a service endpoint
If the authorization was not set and is not optional, it will throw.
```javascript
getEndpointAuthorization(id:string, optional:boolean):EndpointAuthorization
```
 
Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint
optional | boolean | whether the url is optional
 
 
<br/>
<div id="DiskFunctions">
## Disk Functions
 
---
 
Functions for disk operations
<br/>
<div id="taskwhich">
### task.which <a href="#index">(^)</a>
Returns path of a tool had the tool actually been invoked.  Resolves via paths.
If you check and the tool does not exist, it will throw.
```javascript
which(tool:string, check?:boolean):string
```
 
Param | Type | Description
--- | --- | ---
tool | string | name of the tool
check | boolean | whether to check if tool exists
 
<br/>
<div id="taskcheckPath">
### task.checkPath <a href="#index">(^)</a>
Checks whether a path exists.
If the path does not exist, it will throw.
```javascript
checkPath(p:string, name:string):void
```
 
Param | Type | Description
--- | --- | ---
p | string | path to check
name | string | name only used in error message to identify the path
 
<br/>
<div id="taskexist">
### task.exist <a href="#index">(^)</a>
Returns whether a path exists.
```javascript
exist(path:string):boolean
```
 
Param | Type | Description
--- | --- | ---
path | string | path to check
 
<br/>
<div id="taskcd">
### task.cd <a href="#index">(^)</a>
Change working directory.
```javascript
cd(path:string):void
```
 
Param | Type | Description
--- | --- | ---
path | string | new working directory path
 
<br/>
<div id="taskcp">
### task.cp <a href="#index">(^)</a>
Returns path of a tool had the tool actually been invoked.  Resolves via paths.
If you check and the tool does not exist, it will throw.
Returns whether the copy was successful
```javascript
cp(source:string, dest:string, options?:string, continueOnError?:boolean):void
```
 
Param | Type | Description
--- | --- | ---
source | string | source path
dest | string | destination path
options | string | string -r, -f or -rf for recursive and force
continueOnError | boolean | optional. whether to continue on error

 
<br/>
<div id="taskmv">
### task.mv <a href="#index">(^)</a>
Moves a path.
Returns whether the copy was successful
```javascript
mv(source:string, dest:string, options?:string, continueOnError?:boolean):void
```
 
Param | Type | Description
--- | --- | ---
source | string | source path
dest | string | destination path
options | string | string -f or -n for force and no clobber
continueOnError | boolean | optional. whether to continue on error

 
<br/>
<div id="taskmkdirP">
### task.mkdirP <a href="#index">(^)</a>
Make a directory.  Creates the full path with folders in between
Will throw if it fails
```javascript
mkdirP(p:string):void
```
 
Param | Type | Description
--- | --- | ---
p | string | path to create
 
<br/>
<div id="taskFindOptions">
### task.FindOptions <a href="#index">(^)</a>
Interface for FindOptions
Contains properties to control whether to follow symlinks
 
Property | Description
--- | ---
followSpecifiedSymbolicLink | Equivalent to the -H command line option. Indicates whether to traverse descendants if the specified path is a symbolic link directory. Does not cause nested symbolic link directories to be traversed.
followSymbolicLinks | Equivalent to the -L command line option. Indicates whether to traverse descendants of symbolic link directories.

 
<br/>
<div id="taskfind">
### task.find <a href="#index">(^)</a>
Find all files under a give path
Returns an array of paths
```javascript
find(findPath:string, options?:FindOptions):string
```
 
Param | Type | Description
--- | --- | ---
findPath | string | path to find files under
options | FindOptions | options to control whether to follow symlinks
 
<br/>
<div id="taskrmRF">
### task.rmRF <a href="#index">(^)</a>
Remove a path recursively with force
Returns whether it succeeds
```javascript
rmRF(path:string, continueOnError?:boolean):void
```
 
Param | Type | Description
--- | --- | ---
path | string | path to remove
continueOnError | boolean | optional. whether to continue on error
 
<br/>
<div id="taskpushd">
### task.pushd <a href="#index">(^)</a>
Change working directory and push it on the stack
```javascript
pushd(path:string):void
```
 
Param | Type | Description
--- | --- | ---
path | string | new working directory path
 
<br/>
<div id="taskpopd">
### task.popd <a href="#index">(^)</a>
Change working directory back to previously pushed directory
```javascript
popd():void
```
<br/>
<div id="taskresolve">
### task.resolve <a href="#index">(^)</a>
Resolves a sequence of paths or path segments into an absolute path.
Calls node.js path.resolve()
Allows L0 testing with consistent path formats on Mac/Linux and Windows in the mock implementation
```javascript
resolve(pathSegments:any):string
```
 
Param | Type | Description
--- | --- | ---
pathSegments | any |  - 
 
<br/>
<div id="taskstats">
### task.stats <a href="#index">(^)</a>
Get's stat on a path.
Useful for checking whether a file or directory.  Also getting created, modified and accessed time.
see [fs.stat](https://nodejs.org/api/fs.html#fs_class_fs_stats)
```javascript
stats(path:string):FsStats
```
 
Param | Type | Description
--- | --- | ---
path | string | path to check
 
<br/>
<div id="taskwriteFile">
### task.writeFile <a href="#index">(^)</a>
Synchronously writes data to a file, replacing the file if it already exists.
See [fs.writeFileSync](https://nodejs.org/api/fs.html#fs_fs_writefilesync_file_data_options)
```javascript
writeFile(file:string, data:undefined, options?:undefined):void
```
 
Param | Type | Description
--- | --- | ---
file | string |  - 
data | undefined |  - 
options | undefined |  - 
 
 
<br/>
<div id="Localization">
## Localization
 
---
 
Localization is optional but is supported using these functions at runtime
 
```javascript
/// <reference path="../definitions/vsts-task-lib.d.ts" />

tl.setResourcePath(path.join( __dirname, 'task.json'));

...

var errMsg = tl.loc('FailedWithReturnCode', code));

// in the task.json
{
    "messages": {
        "FailedWithReturnCode": "Tool exited with return code: %d",
        "ToolFailed": "Tool failed with error: %s"
    }
}
```
<br/>
<div id="tasksetResourcePath">
### task.setResourcePath <a href="#index">(^)</a>
Sets the location of the resources json.  This is typically the task.json file.
Call once at the beginning of the script before any calls to loc.
```javascript
setResourcePath(path:string):void
```
 
Param | Type | Description
--- | --- | ---
path | string | Full path to the json.
 
<br/>
<div id="taskloc">
### task.loc <a href="#index">(^)</a>
Gets the localized string from the json resource file.  Optionally formats with additional params.
```javascript
loc(key:string, param:any):string
```
 
Param | Type | Description
--- | --- | ---
key | string | key of the resources string in the resource file
param | any | additional params for formatting the string
 
