
# VSTS DevOps Task SDK

Libraries for writing [Visual Studio Team Services](https://www.visualstudio.com/en-us/products/visual-studio-team-services-vs.aspx) build and deployment tasks

Reference examples of our in the box tasks [are here](https://github.com/Microsoft/vsts-tasks)

## Status
|   | Build & Test |
|---|:-----:|
|![Win](res/win_med.png) **Windows**|![Build & Test](https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/2553/badge?branch=master)| 
|![Apple](res/apple_med.png) **OSX**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/5471/badge?branch=master)|
|![Ubuntu14](res/ubuntu_med.png) **Ubuntu 14.04**|![Build & Test](https://mseng.visualstudio.com/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/4123/badge?branch=master)|

## Highlights

 * __Breaks coupling with agent:__  This lib is decoupled and ships with the task and the agent is just an engine to run tasks.
 * __Testability:__ Aims to offer the ability to actually run your task scripts under all scenarios without a server or an agent.
 * __Localization:__ The lib provides a mechanism for storing your localized strings with your task, and loading the correct set at run-time.
 * __Consistent API:__ The TypeScript and PowerShell libs are largely consistent. They only differ where it makes sense (being true to the platform).
 * __Tracing for free:__ Tracing has been built-in to many of the commands. Use the SDK and get some debug tracing for free.

## TypeScript Tasks

Cross platform tasks are written in TypeScript.  It is the preferred way to write tasks once.

[![NPM version][npm-lib-image]][npm-lib-url] ![VSTS](https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/2553/badge)

Documentation: [Creating Node Tasks with the Typescript API](node/README.md)

## PowerShell Tasks

A task which automates Powershell technologies can be written with our Powershell SDK.  These only run on Windows.

Documentation: [PowerShell API](powershell/Docs/README.md)


[npm-lib-image]: https://img.shields.io/npm/v/vsts-task-lib.svg?style=flat
[npm-lib-url]: https://www.npmjs.com/package/vsts-task-lib
[npm-sdk-image]: https://img.shields.io/npm/v/vsts-task-sdk.svg?style=flat
[npm-sdk-url]: https://www.npmjs.com/package/vsts-task-sdk
