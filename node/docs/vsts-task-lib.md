# VSTS-TASK-LIB TYPESCRIPT API
 
## Importing
For now, the built vsts-task-lib (in _build) should be packaged with your task in a node_modules folder
 
The build generates a vsts-task-lib.d.ts file for use when compiling tasks
In the example below, it is in a folder named definitions above the tasks lib
 
```
/// <reference path="../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/vsotask')
```
 
 
## Input Functions
 
Functions for retrieving inputs for the task
 
<div id="vsotask.getInput">
### vsotask.getInput
```javascript
getInput(name:string, required?:boolean):string
```
<div id="vsotask.getPathInput">
### vsotask.getPathInput
```javascript
getPathInput(name:string, required?:boolean, check?:boolean):string
```
 
## Execution
 
Tasks typically execute a series of tools (cli) and set the result of the task based on the outcome of those
 
```javascript
/// <reference path="../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/vsotask');

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
<div id="vsotask.createToolRunner">
### vsotask.createToolRunner
```javascript
createToolRunner(tool:string):ToolRunner
```
<div id="toolrunner.ToolRunner.arg">
### toolrunner.ToolRunner.arg
```javascript
arg(val:any):void
```
<div id="toolrunner.ToolRunner.argIf">
### toolrunner.ToolRunner.argIf
```javascript
argIf(condition:any, val:any):void
```
<div id="toolrunner.ToolRunner.exec">
### toolrunner.ToolRunner.exec
```javascript
exec(options?:IExecOptions):Promise
```
<div id="toolrunner.ToolRunner.execSync">
### toolrunner.ToolRunner.execSync
```javascript
execSync(options?:IExecOptions):IExecResult
```
<div id="vsotask.setResult">
### vsotask.setResult
setResult sets the result of the task.
```javascript
setResult(result:TaskResult, message:string):void
```
<div id="vsotask.setVariable">
### vsotask.setVariable
```javascript
setVariable(name:string, val:string):void
```
 
## Disk Functions
 
Functions for disk operations
 
<div id="vsotask.cd">
### vsotask.cd
```javascript
cd(path:string):void
```
<div id="vsotask.cp">
### vsotask.cp
```javascript
cp(options:any, source:string, dest:string, continueOnError?:boolean):boolean
```
