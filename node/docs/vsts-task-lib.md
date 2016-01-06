# VSTS-TASK-LIB TYPESCRIPT API
 
## Importing
For now, the built vsts-task-lib (in _build) should be packaged with your task in a node_modules folder
 
The build generates a vsts-task-lib.d.ts file for use when compiling tasks
In the example below, it is in a folder named definitions above the tasks lib
 
```
/// <reference path="../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/task')
```
 
<div id="index">
## Index
 
### Input Functions <a href="#InputFunctions">(v)</a>
 
<a href="#taskgetInput">getInput</a> <br/>
<a href="#taskgetBoolInput">getBoolInput</a> <br/>
<a href="#taskgetPathInput">getPathInput</a> <br/>
<a href="#taskfilePathSupplied">filePathSupplied</a> <br/>
<a href="#taskgetDelimitedInput">getDelimitedInput</a> <br/>
<a href="#taskgetVariable">getVariable</a> <br/>
<a href="#tasksetVariable">setVariable</a> <br/>
 
### Execution <a href="#Execution">(v)</a>
 
<a href="#taskcreateToolRunner">createToolRunner</a> <br/>
<a href="#toolrunnerToolRunnerarg">ToolRunner.arg</a> <br/>
<a href="#toolrunnerToolRunnerargIf">ToolRunner.argIf</a> <br/>
<a href="#toolrunnerToolRunnerexec">ToolRunner.exec</a> <br/>
<a href="#toolrunnerToolRunnerexecSync">ToolRunner.execSync</a> <br/>
<a href="#tasksetResult">setResult</a> <br/>
 
### Disk Functions <a href="#DiskFunctions">(v)</a>
 
<a href="#taskcd">cd</a> <br/>
<a href="#taskcp">cp</a> <br/>
 
### Localization <a href="#Localization">(v)</a>
 
<a href="#tasksetResourcePath">setResourcePath</a> <br/>
<a href="#taskloc">loc</a> <br/>
 
 
<div id="InputFunctions">
## Input Functions
 
---
 
Functions for retrieving inputs for the task
<br/>
<div id="taskgetInput">
### task.getInput <a href="#index">(^)</a>
Gets the value of an input.  The value is also trimmed.
If required is true and the value is not set, the task will fail with an error.  Execution halts.
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
If required is true and the value is not set, the task will fail with an error.  Execution halts.
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
If required is true and the value is not set, the task will fail with an error.  Execution halts.
If check is true and the path does not exist, the task will fail with an error.  Execution halts.
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
Gets the value of an input and splits the values by a delimiter (space, comma, etc...)
Useful for splitting an input with simple list of items like targets
IMPORTANT: Do not use for splitting additional args!  Instead use arg() - it will split and handle
If required is true and the value is not set, the task will fail with an error.  Execution halts.
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
Gets a variables value which is defined on the build definition or set at runtime.
```javascript
getVariable(name:string):string
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the variable to get
 
<br/>
<div id="tasksetVariable">
### task.setVariable <a href="#index">(^)</a>
Sets a variables which will be available to subsequent tasks as well.
```javascript
setVariable(name:string, val:string):void
```
 
Param | Type | Description
--- | --- | ---
name | string | name of the variable to set
val | string | value to set
 
 
 
<div id="Execution">
## Execution
 
---
 
Tasks typically execute a series of tools (cli) and set the result of the task based on the outcome of those
 
```javascript
/// <reference path="../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/task');

var toolPath = tl.which('atool');
var tool = tl.createToolRunner(toolPath);

tool.arg('--afile');
tool.arg(tl.getPathInput('afile', true));

// NOTE: arg function handles complex additional args with double quotes like
//       "arg one" arg2 -x
//
tool.arg(tl.getInput('arguments', false));

tool.exec()
.then((code) => {
    tl.setResult(tl.TaskResult.Succeeded, "tool returned " + code);
})
.fail((err) => {
    tl.debug('toolRunner fail');
    tl.setResult(tl.TaskResult.Failed, err.message);
})
```
<br/>
<div id="taskcreateToolRunner">
### task.createToolRunner <a href="#index">(^)</a>
```javascript
createToolRunner(tool:string):ToolRunner
```
 
Param | Type | Description
--- | --- | ---
tool | string |  - 
 
<br/>
<div id="toolrunnerToolRunnerarg">
### toolrunner.ToolRunner.arg <a href="#index">(^)</a>
```javascript
arg(val:any):void
```
 
Param | Type | Description
--- | --- | ---
val | any |  - 
 
<br/>
<div id="toolrunnerToolRunnerargIf">
### toolrunner.ToolRunner.argIf <a href="#index">(^)</a>
```javascript
argIf(condition:any, val:any):void
```
 
Param | Type | Description
--- | --- | ---
condition | any |  - 
val | any |  - 
 
<br/>
<div id="toolrunnerToolRunnerexec">
### toolrunner.ToolRunner.exec <a href="#index">(^)</a>
```javascript
exec(options?:IExecOptions):Promise
```
 
Param | Type | Description
--- | --- | ---
options | IExecOptions |  - 
 
<br/>
<div id="toolrunnerToolRunnerexecSync">
### toolrunner.ToolRunner.execSync <a href="#index">(^)</a>
```javascript
execSync(options?:IExecOptions):IExecResult
```
 
Param | Type | Description
--- | --- | ---
options | IExecOptions |  - 
 
<br/>
<div id="tasksetResult">
### task.setResult <a href="#index">(^)</a>
Sets the result of the task.
If the result is Failed (1), then execution will halt.
```javascript
setResult(result:TaskResult, message:string):void
```
 
Param | Type | Description
--- | --- | ---
result | TaskResult | TaskResult enum of Success or Failed.  If the result is Failed (1), then execution will halt.
message | string |  - 
 
 
 
<div id="DiskFunctions">
## Disk Functions
 
---
 
Functions for disk operations
<br/>
<div id="taskcd">
### task.cd <a href="#index">(^)</a>
```javascript
cd(path:string):void
```
 
Param | Type | Description
--- | --- | ---
path | string |  - 
 
<br/>
<div id="taskcp">
### task.cp <a href="#index">(^)</a>
```javascript
cp(options:any, source:string, dest:string, continueOnError?:boolean):boolean
```
 
Param | Type | Description
--- | --- | ---
options | any |  - 
source | string |  - 
dest | string |  - 
continueOnError | boolean |  - 
 
 
 
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
 
