![VSO] (https://mseng.visualstudio.com/DefaultCollection/_apis/public/build/definitions/b924d696-3eae-4116-8443-9a18392d8544/2553/badge)
# VSTS DevOps Task SDK

Libraries for writing Visual Studio Team Services build and deployment tasks

## Node Task Lib
Library for writing tasks with the node handler

## Documentation

Cross platform tasks are written in Typescript.  It is the preferred way to write tasks once.
[Typescript API](node/docs/vsts-task-lib.md)

A task which automates Powershell technologies can be written with our Powershell SDK.  These only run on windows.
(Powershell API documentation coming soon)

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

### Powershell

Coming soon
