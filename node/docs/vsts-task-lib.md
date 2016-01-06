# VSTS-TASK-LIB TYPESCRIPT API
 
## Importing
For now, the built vsts-task-lib (in _build) should be packaged with your task in a node_modules folder
 
The build generates a vsts-task-lib.d.ts file for use when compiling tasks
In the example below, it is in a folder named definitions above the tasks lib
 
```
/// <reference path="../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/vsotask')
```
 
## Index
 
<div id="index">
### Input Functions
 
<a href="#vsotaskgetInput">getInput</a> <br/>
<a href="#vsotaskgetPathInput">getPathInput</a> <br/>
 
<div id="index">
### Execution
 
<a href="#vsotaskcreateToolRunner">createToolRunner</a> <br/>
<a href="#toolrunnerToolRunnerarg">ToolRunner.arg</a> <br/>
<a href="#toolrunnerToolRunnerargIf">ToolRunner.argIf</a> <br/>
<a href="#toolrunnerToolRunnerexec">ToolRunner.exec</a> <br/>
<a href="#toolrunnerToolRunnerexecSync">ToolRunner.execSync</a> <br/>
<a href="#vsotasksetResult">setResult</a> <br/>
<a href="#vsotasksetVariable">setVariable</a> <br/>
 
<div id="index">
### Disk Functions
 
<a href="#vsotaskcd">cd</a> <br/>
<a href="#vsotaskcp">cp</a> <br/>
 
## Input Functions
 
Functions for retrieving inputs for the task
 
<div id="vsotaskgetInput">
### vsotask.getInput <a href="#index">(^)</a>
```javascript
getInput(name:string, required?:boolean):string
```
<div id="vsotaskgetPathInput">
### vsotask.getPathInput <a href="#index">(^)</a>
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
<div id="vsotaskcreateToolRunner">
### vsotask.createToolRunner <a href="#index">(^)</a>
```javascript
createToolRunner(tool:string):ToolRunner
```
<div id="toolrunnerToolRunnerarg">
### toolrunner.ToolRunner.arg <a href="#index">(^)</a>
```javascript
arg(val:any):void
```
<div id="toolrunnerToolRunnerargIf">
### toolrunner.ToolRunner.argIf <a href="#index">(^)</a>
```javascript
argIf(condition:any, val:any):void
```
<div id="toolrunnerToolRunnerexec">
### toolrunner.ToolRunner.exec <a href="#index">(^)</a>
```javascript
exec(options?:IExecOptions):Promise
```
<div id="toolrunnerToolRunnerexecSync">
### toolrunner.ToolRunner.execSync <a href="#index">(^)</a>
```javascript
execSync(options?:IExecOptions):IExecResult
```
<div id="vsotasksetResult">
### vsotask.setResult <a href="#index">(^)</a>
setResult sets the result of the task.
```javascript
setResult(result:TaskResult, message:string):void
```
<div id="vsotasksetVariable">
### vsotask.setVariable <a href="#index">(^)</a>
```javascript
setVariable(name:string, val:string):void
```
 
## Disk Functions
 
Functions for disk operations
 
<div id="vsotaskcd">
### vsotask.cd <a href="#index">(^)</a>
```javascript
cd(path:string):void
```
<div id="vsotaskcp">
### vsotask.cp <a href="#index">(^)</a>
```javascript
cp(options:any, source:string, dest:string, continueOnError?:boolean):boolean
```
