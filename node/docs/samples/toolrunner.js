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