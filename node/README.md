
# VSTS DevOps Task SDK

Libraries for writing [Visual Studio Team Services](https://www.visualstudio.com/en-us/products/visual-studio-team-services-vs.aspx) build and deployment tasks

![VSTS](https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/2553/badge)

Reference examples of our in the box tasks [are here](https://github.com/Microsoft/vsts-tasks)

## TypeScript Tasks

Cross platform tasks are written in TypeScript.  It is the preferred way to write tasks once.

[![NPM version][npm-lib-image]][npm-lib-url]

Step by Step: [Create Task](docs/stepbystep.md)  

Documentation: [TypeScript API](docs/azure-pipelines-task-lib.md), [task JSON schema](https://aka.ms/vsts-tasks.schema.json)

Guidance: [Finding Files](docs/findingfiles.md), [Minimum agent version](docs/minagent.md), [Proxy](docs/proxy.md), [Certificate](docs/cert.md)

## Reference Examples

The [ShellScript Task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/ShellScriptV2) and the [XCode Task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/XcodeV5) are good examples.

## Contributing

We are accepting contributions and we try to stay on top of issues. Guidance on contributing code or issues can be found [here](../CONTRIBUTING.md).

## Building the library

Once:
```bash
$ cd node
$ npm install
```

Build and Test:
```bash
$ npm test
```

Set environment variable TASK_TEST_TRACE=1 to display test output.

[npm-lib-image]: https://img.shields.io/npm/v/azure-pipelines-task-lib.svg?style=flat
[npm-lib-url]: https://www.npmjs.com/package/azure-pipelines-task-lib

## Powershell

We also maintain a PowerShell library for Windows task development.

Library: [Powershell Library](../powershell)

Usage: [Consuming the SDK](../powershell/Docs/Consuming.md)

## Third Party Notices
To generate/update third party notice file run:
```bash
$ node generate-third-party-notice.js
```
