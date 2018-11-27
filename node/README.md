
# Azure Pipelines Task SDK

Libraries for writing [Azure Pipelines](https://azure.microsoft.com/en-us/services/devops/pipelines) tasks

Reference examples of our in the box tasks [are here](https://github.com/Microsoft/azure-pipelines-tasks)

## TypeScript Tasks

Cross platform tasks are written in TypeScript.  It is the preferred way to write tasks once.

[![NPM version][npm-lib-image]][npm-lib-url]

Step by Step: [Create Task](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=vsts)  

Documentation: [TypeScript API](docs/azure-pipelines-task-lib.md), [task JSON schema](https://aka.ms/vsts-tasks.schema.json)

Guidance: [Finding Files](docs/findingfiles.md), [Minimum agent version](docs/minagent.md), [Proxy](docs/proxy.md), [Certificate](docs/cert.md)

## Reference Examples

The [ShellScript Task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/ShellScriptV2) and the [XCode Task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/XcodeV5) are good examples.

## Contributing

### Node

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

## Third Party Notices
To generate/update third party notice file run:
```bash
$ node generate-third-party-notice.js
```
