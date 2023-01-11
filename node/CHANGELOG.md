# Node.js task lib changes

## 3.x

### 3.3.1

- Update minimatch to version 3.0.5 to fix vulnerability - [#836](https://github.com/microsoft/azure-pipelines-task-lib/pull/836)

### 3.4.0

- Updated mockery and mocha dependencies - [#875](https://github.com/microsoft/azure-pipelines-task-lib/pull/875)

- Include uncought exceptions stack trace to the output logs - [#895](https://github.com/microsoft/azure-pipelines-task-lib/pull/895)

## 4.x

### 4.0.0-preview

- Introduced support for node 16 task handler - [#844](https://github.com/microsoft/azure-pipelines-task-lib/pull/844)

### 4.0.1-preview

- Added node16 to task.schema.json - [#852](https://github.com/microsoft/azure-pipelines-task-lib/pull/852)
- fix ToolRunner - _getSpawnSyncOptions - [#873](https://github.com/microsoft/azure-pipelines-task-lib/pull/873)

### 4.0.2

- Updated mockery because of vulnerabilities - [#878](https://github.com/microsoft/azure-pipelines-task-lib/pull/878)

## 4.1.0

Backported from ver.`3.4.0`:

- Include uncought exceptions stack trace to the output logs - [#895](https://github.com/microsoft/azure-pipelines-task-lib/pull/895)

## 4.2.0

- Added unhandledRejection event - [#912](https://github.com/microsoft/azure-pipelines-task-lib/pull/912)