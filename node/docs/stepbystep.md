# Step by Step: Node Task with Typescript API

This step by step will show how to manually create, debug and test a cross platform task with no service, server or agent!

Tasks can be created using tfx as a convenience, but it's good to understand the parts of a task.  
This tutorial walks through each manual step of creating a task.

Note: The tutorial was done on a mac.  Attempted to make generic for all platforms.  Create issues in the repo.

## Video

TODO: posting soon

## Tools 

[Typescript Compiler 1.8.7 or greater](https://www.npmjs.com/package/typescript)
[Node 4.4.7 (LTS) or greater](https://nodejs.org/en/)  
[Npm 3.0 or greater recommended](https://www.npmjs.com/package/npm3) (comes with node >=5. creates flat dependencies in tasks)  
[Typings 1.0 or greater](https://github.com/typings/typings/blob/master/README.md)  

This tutorial uses [VS Code](https://code.visualstudio.com) for great intellisense and debugging support

## Sample Files

Files used for this walk through are [located here in this gist](https://gist.github.com/bryanmacfarlane/154f14dd8cb11a71ef04b0c836e5be6e)**

## Create Task Scaffolding

Create a directory and package.json.  Accept defaults of npm init for sample.
```bash
$ mkdir sampletask && cd sampletask
$ npm init
```

### Add vsts-task-lib

Add vsts-task-lib to your task.  Remember your task must carry the lib.  
Ensure it's at least 0.9.5 which now carries typings.  
The package.json should have dependency with ^.  Ex: ^0.9.5.  This means you are locked to 0.9.x and will pick up patches on npm install.

The npm module carries the .d.ts typecript definition files so compile and intellisense support will just work.

```
$ npm install vsts-task-lib --save
sampletask@1.0.0 /Users/bryan/Projects/sampletask
└─┬ vsts-task-lib@0.9.5 
... 
```

### Add Typings for Externals

Create a typings.json and add external dependencies

```bash
$ touch typings.json
$ typings install dt~node --global --save
$ typings install dt~q --global --save
```

Create a .gitignore and add node_modules and typings to it.  
Your build process should do `npm install` and `typings install`.  No need to checkin dependencies.

```bash
$ cat .gitignore
node_modules
typings
```

### Create tsconfig.json Compiler Options

Create a `tsconfig.json` file from the sample gist.  The most important piece being ES6 for async await support.

## Task Implementation

Now that the scaffolding is out of the way, let's create the task!

Create a `task.json` file using `sample_task.json` as a starting point.  
Replace the `{{placeholders}}`.  The most important being a [unique guid](http://www.guidgen.com/).
Note: copy from web view since file needs property names in quotes (browser might strip in raw view)

Create a `index.ts` file using sample_task.ts as a starting point.

Instellisense should just work in [VS Code](https://code.visualstudio.com)

The code is straight forward.  As a reference:

```javascript
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function run() {
    try {
        // easy chaining of arguments
        let rc1: number = await tl.tool('echo').arg(tl.getInput('samplestring', true)).exec();
        
        let rc2: number = -1;
        if (tl.getBoolInput('samplebool')) {
            // linear async coding
            rc2 = await tl.tool('echo').arg(tl.getInput('samplepathinput', true)).exec();    
        }
        
        console.log('Task done! ' + rc1 + ',' + rc2);
    }
    catch (err) {
        // handle failures in one place
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();
```

Key Points:

 - Async code is linear.  Note the two executions written one after each other in linear fashion.
 - Must be wrapped in async function.
 - Greatly simplifies error handling.
 - Never process.exit your task.  You can sometimes lose output and often the last bit of output is critical

If we did our job well, the code should be pretty self explanatory.    
But, see the [API Reference](vsts-task-lib.md) for specifics.

## Compile

Just type `tsc` from the root of the task.  That should have compiled a task.js

## Run the Task

The task can be run by simply running `node task.js`.  Note that is exactly what our agent will do.

```bash
$ node index.js
##vso[task.debug]agent.workFolder=undefined
##vso[task.debug]loading inputs and endpoints
##vso[task.debug]loaded 0
##vso[task.debug]task result: Failed
##vso[task.issue type=error;]Input required: samplestring
##vso[task.complete result=Failed;]Input required: samplestring
``` 

The task failed!  That's exactly what would happen if the task run and inputs were not supplied.

The agent runs the task and reads key information from command output output over stdout and stderr.  This allows for consistency in node, powershell or even ad-hoc scripts.  The lib is mostly a thin wrapper generating those commands.

Let's supply one of the inputs and try again.

```bash
$ export INPUT_SAMPLESTRING="Hello World"
$ node index.js
##vso[task.debug]agent.workFolder=undefined
##vso[task.debug]loading inputs and endpoints
##vso[task.debug]loading INPUT_SAMPLESTRING
##vso[task.debug]loaded 1
##vso[task.debug]samplestring=Hello World
##vso[task.debug]echo arg: Hello World
##vso[task.debug]exec tool: echo
##vso[task.debug]Arguments:
##vso[task.debug]   Hello World
[command]echo Hello World
Hello World
##vso[task.debug]rc:0
##vso[task.debug]success:true
##vso[task.debug]samplebool=null
Task done! 0,-1
-=B=- ~/Projects/sampletask$ 
```

Now let's set the sample bool.  This should fail since if sample bool is true, it should need the other input.  See the code.

```bash
-=B=- ~/Projects/sampletask$ export INPUT_SAMPLEBOOL=true
-=B=- ~/Projects/sampletask$ node index.js
##vso[task.debug]agent.workFolder=undefined
##vso[task.debug]loading inputs and endpoints
##vso[task.debug]loading INPUT_SAMPLEBOOL
##vso[task.debug]loading INPUT_SAMPLESTRING
##vso[task.debug]loaded 2
##vso[task.debug]samplestring=Hello World
##vso[task.debug]echo arg: Hello World
##vso[task.debug]exec tool: echo
##vso[task.debug]Arguments:
##vso[task.debug]   Hello World
[command]echo Hello World
Hello World
##vso[task.debug]rc:0
##vso[task.debug]success:true
##vso[task.debug]samplebool=true
##vso[task.debug]task result: Failed
##vso[task.issue type=error;]Input required: samplepathinput
##vso[task.complete result=Failed;]Input required: samplepathinput
-=B=- ~/Projects/sampletask$ 
```

So, as you can see, this offers powerful testing automation options to test all arcs with no agent or server.

## Interactive Use from Command Line (Advanced)

Node offers an interactive console and since the task lib is in your node_modules folder, you can interactively poke around.

```bash
$ node
> var tl = require('vsts-task-lib/task');
##vso[task.debug]agent.workFolder=undefined
##vso[task.debug]loading inputs and endpoints
##vso[task.debug]loaded 0
undefined
> tl.which('echo');
##vso[task.debug]echo=/bin/echo
'/bin/echo'
> tl.tool('echo').toolPath
'echo'
> tl.tool('echo').arg('Hello World!').args
##vso[task.debug]echo arg: Hello World!
[ 'Hello World!' ]
> .exit

```
## Debugging

Coming soon

## Add Task to an Extension

Coming soon
