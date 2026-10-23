
# Azure Pipelines Task SDK

Libraries for writing [Azure Pipelines](https://azure.microsoft.com/en-us/services/devops/pipelines) tasks

Reference examples of our in the box tasks [are here](https://github.com/Microsoft/azure-pipelines-tasks)

## TypeScript Tasks

Cross platform tasks are written in TypeScript.  It is the preferred way to write tasks once.

[![NPM version][npm-lib-image]][npm-lib-url]

Step by Step: [Create Task](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=vsts)

Documentation: [TypeScript API](https://github.com/microsoft/azure-pipelines-task-lib/blob/master/node/docs/azure-pipelines-task-lib.md), [task JSON schema](https://aka.ms/vsts-tasks.schema.json)

Guidance: [Finding Files](https://github.com/microsoft/azure-pipelines-task-lib/blob/master/node/docs/findingfiles.md), [Minimum agent version](https://github.com/microsoft/azure-pipelines-task-lib/blob/master/node/docs/minagent.md), [Proxy](https://github.com/microsoft/azure-pipelines-task-lib/blob/master/node/docs/proxy.md), [Certificate](https://github.com/microsoft/azure-pipelines-task-lib/blob/master/node/docs/cert.md)

## Node Runtime Support

Azure Pipelines supports multiple Node.js runtimes for task execution:

* **Node 6** - Supported
* **Node 10** - Supported
* **Node 16** - Supported
* **Node 20** - Current recommended version
* **Node 24** - Latest version with modern JavaScript features

### Node Version Selection

The Node runtime used depends on the `execution` handler specified in your task's `task.json`:
* `Node` - Uses Node 6 
* `Node10` - Uses Node 10 
* `Node16` - Uses Node 16
* `Node20_1` - Uses Node 20 (Note: handler name includes _1 suffix)
* `Node24` - Uses Node 24

### Upgrading to Newer Node Versions

When upgrading your tasks to newer Node versions:
* **TypeScript**: Ensure you're using a compatible TypeScript version (TS 4.0+ for Node 10+, TS 5.0+ for Node 20+, TS 5.7+ for Node 24)
* **Dependencies**: Review and update npm dependencies for compatibility with the target Node version
* **Testing**: Thoroughly test your tasks with the new Node runtime before publishing
* **Breaking Changes**: Review Node.js release notes for breaking changes between versions (especially `fs` module changes)

## Reference Examples

### ZIP utilities

The exported ZIP helpers use `adm-zip@0.6.1` and require Node.js 14 or newer.
They can also be imported from `azure-pipelines-task-lib/ziputility`.

```typescript
import { createZip, extractZip } from 'azure-pipelines-task-lib/ziputility';

await createZip(sourceDirectory, zipLocation);
await extractZip(zipLocation, { dir: unzipLocation, overwrite: true });
```

`extractZip` returns the destination directory; `createZip` returns the archive
path. Errors reject the returned Promise. These are Promise wrappers around
synchronous ZIP processing, not non-blocking implementations.

For synchronous callers, use `extractZipSync` and `createZipSync`; errors throw.
Extraction accepts either a destination string or options with `dir`,
`overwrite` (default `false`), `keepOriginalPermission` (default `false`), and
an optional `password`. Creation accepts optional `zipPath` and `filter` options
passed to `adm-zip`'s `addLocalFolder`. Dependency errors are propagated unchanged.
No additional extraction limits or symlink policies are provided by these wrappers.


The [ShellScript Task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/ShellScriptV2) and the [XCode Task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/XcodeV5) are good examples.

## Contributing

We are accepting contributions and we try to stay on top of issues.

[Contribution Guide](https://github.com/microsoft/azure-pipelines-task-lib/blob/master/CONTRIBUTING.md).

[Logging Issues](https://github.com/Microsoft/azure-pipelines-task-lib/issues)

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

Library: [Powershell Library](https://github.com/microsoft/azure-pipelines-task-lib/tree/master/powershell)

Usage: [Consuming the SDK](https://github.com/microsoft/azure-pipelines-task-lib/blob/master/powershell/Docs/Consuming.md)

## Third Party Notices
To generate/update third party notice file run:
```bash
$ node generate-third-party-notice.js
```
