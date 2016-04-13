
# VSTS DevOps Task SDK

Libraries for writing [Visual Studio Team Services](https://www.visualstudio.com/en-us/products/visual-studio-team-services-vs.aspx) build and deployment tasks

![VSO](https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/2553/badge)

Reference examples of our in the box tasks [are here](https://github.com/Microsoft/vso-agent-tasks)

## Typescript Tasks  

Cross platform tasks are written in Typescript.  It is the preferred way to write tasks once.

[![NPM version][npm-lib-image]][npm-lib-url]

Documentation: [Typescript API](node/docs/vsts-task-lib.md)

## PowerShell Tasks

A task which automates Powershell technologies can be written with our Powershell SDK.  These only run on Windows.

[![NPM version][npm-sdk-image]][npm-sdk-url]

Documentation: [PowerShell API](powershell/Docs/README.md)

## Contributing

### Node

Once:
```bash
$ cd node
$ npm install
$ sudo npm install gulp -g
```

Build:
```bash
$ cd node
$ gulp
```

Test:
```bash
$ cd node
$ gulp test
```

Set environment variable TASK_TEST_TRACE=1 to display test output.

### Powershell

Once:
```bash
$ cd powershell
$ npm install
$ sudo npm install gulp -g
```

Build:
```bash
$ cd powershell
$ gulp
```

Test:
```bash
$ cd powershell
$ gulp test
```

[npm-lib-image]: https://img.shields.io/npm/v/vsts-task-lib.svg?style=flat
[npm-lib-url]: https://www.npmjs.com/package/vsts-task-lib
[npm-sdk-image]: https://img.shields.io/npm/v/vsts-task-sdk.svg?style=flat
[npm-sdk-url]: https://www.npmjs.com/package/vsts-task-sdk

Set environment variable TASK_TEST_TRACE=1 to display test output.
