
# VSTS DevOps Task SDK

Libraries for writing [Visual Studio Team Services](https://www.visualstudio.com/en-us/products/visual-studio-team-services-vs.aspx) build and deployment tasks

![VSTS](https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/2553/badge)

Reference examples of our in the box tasks [are here](https://github.com/Microsoft/vsts-tasks)

## Typescript Tasks  

Cross platform tasks are written in Typescript.  It is the preferred way to write tasks once.

[![NPM version][npm-lib-image]][npm-lib-url]

Step by Step: [Create Task](docs/stepbystep.md)  

Documentation: [Typescript API](docs/vsts-task-lib.md)

Guidance: [Finding Files](docs/findingfiles.md)

## Reference Examples

The [ShellScript Task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/ShellScript) and the [XCode Task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/Xcode) are good examples.

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

[npm-lib-image]: https://img.shields.io/npm/v/vsts-task-lib.svg?style=flat
[npm-lib-url]: https://www.npmjs.com/package/vsts-task-lib
