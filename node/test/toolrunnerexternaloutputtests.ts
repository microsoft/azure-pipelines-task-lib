// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import os = require('os');
import stream = require('stream');
import * as tl from '../_build/task';
import * as trm from '../_build/toolrunner';

import testutil = require('./testutil');

// Accumulates everything written to it so a display stream can be inspected.
class Collector extends stream.Writable {
    public chunks: Buffer[] = [];
    _write(chunk: any, _enc: string, cb: (err?: Error | null) => void): void {
        this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8'));
        cb();
    }
    public text(): string {
        return Buffer.concat(this.chunks).toString('utf8');
    }
}

// Builds the marker via concatenation so it never appears literally in argv (keeps the command-line
// echo marker-free and lets each test assert purely on the child's stdout/stderr).
function printScript(streamName: 'stdout' | 'stderr', body: string): string {
    return `process.${streamName}.write(["##","vso[","${body}"].join(""))`;
}

function interleavedScript(): string {
    return [
        'process.stdout.write(["##","v"].join(""))',
        'setTimeout(() => process.stderr.write("middle"), 10)',
        'setTimeout(() => process.stdout.write("so[task.complete]"), 20)'
    ].join(';');
}

async function runPipedWithDelayedStderr(useLegacyExec: boolean): Promise<string> {
    const out = new Collector();
    const upstream = tl.tool(process.execPath)
        .arg('-e')
        .arg('setTimeout(() => process.stderr.write(["##","vso[task.complete]late"].join("")), 50)');
    const downstream = tl.tool(process.execPath).arg('-e').arg('process.exit(0)');
    upstream.pipeExecOutputToTool(downstream);

    const options = <trm.IExecOptions>{
        outStream: out,
        errStream: testutil.getNullStream(),
        externalOutput: { source: 'childProcess' }
    };
    if (useLegacyExec) {
        await upstream.exec(options);
    } else {
        await upstream.execAsync(options);
    }
    return out.text();
}

describe('Toolrunner External Output', function () {

    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + (err as Error).message);
        }
        done();
    });

    it('neutralizes a marker in the displayed stdout while leaving raw events intact', async function () {
        this.timeout(20000);
        const out = new Collector();
        const raw: Buffer[] = [];
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stdout', 'task.setvariable]hi'));
        tool.on('stdout', (d: Buffer) => raw.push(d));

        await tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: testutil.getNullStream(),
            externalOutput: { source: 'childProcess' }
        });

        const disp = out.text();
        assert(disp.indexOf('##_vso[task.setvariable') >= 0, 'display should be neutralized');
        assert(disp.indexOf('##vso[') < 0, 'display must not contain a live marker');
        assert(Buffer.concat(raw).toString('utf8').indexOf('##vso[task.setvariable') >= 0, 'raw stdout event must be unchanged');
    });

    it('keeps a trailing incomplete marker before the synthetic newline', async function () {
        this.timeout(20000);
        const out = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stdout', 'task.deb'));

        await tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: testutil.getNullStream(),
            externalOutput: { source: 'childProcess', enableVsoCommands: true }
        });

        assert(out.text().endsWith('##_vso[task.deb' + os.EOL));
    });

    it('preserves stdout and stderr order when both use outStream', async function () {
        this.timeout(20000);
        const out = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(interleavedScript());

        await tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: testutil.getNullStream(),
            externalOutput: { source: 'childProcess' }
        });

        assert(out.text().endsWith('##vmiddleso[task.complete]' + os.EOL));
    });

    it('keeps piped filtering active until both processes close', async function () {
        this.timeout(20000);
        for (const useLegacyExec of [false, true]) {
            const output = await runPipedWithDelayedStderr(useLegacyExec);
            assert(output.indexOf('##_vso[task.complete]late') >= 0);
            assert(output.indexOf('##vso[task.complete]late') < 0);
        }
    });

    it('passes an allowlisted marker through the display unchanged', async function () {
        this.timeout(20000);
        const out = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stdout', 'task.debug]d'));

        await tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: testutil.getNullStream(),
            externalOutput: { source: 'childProcess', enableVsoCommands: true }
        });

        const disp = out.text();
        assert(disp.indexOf('##vso[task.debug]') >= 0, 'allowlisted marker should survive');
        assert(disp.indexOf('##_vso[') < 0, 'allowlisted marker should not be neutralized');
    });

    it('does not filter displayed output when externalOutput is absent', async function () {
        this.timeout(20000);
        const out = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stdout', 'task.setvariable]hi'));

        await tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: testutil.getNullStream()
        });

        assert(out.text().indexOf('##vso[task.setvariable') >= 0, 'unfiltered path must preserve the marker');
    });

    it('neutralizes a marker in displayed stderr while leaving raw events intact', async function () {
        this.timeout(20000);
        const out = new Collector();
        const raw: Buffer[] = [];
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stderr', 'task.complete]bye'));
        tool.on('stderr', (d: Buffer) => raw.push(d));

        // failOnStdErr false -> stderr display routes to outStream; still filtered.
        await tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: testutil.getNullStream(),
            failOnStdErr: false,
            externalOutput: { source: 'childProcess' }
        });

        const disp = out.text();
        assert(disp.indexOf('##_vso[task.complete') >= 0, 'stderr display should be neutralized');
        assert(disp.indexOf('##vso[') < 0, 'stderr display must not contain a live marker');
        assert(Buffer.concat(raw).toString('utf8').indexOf('##vso[task.complete') >= 0, 'raw stderr event must be unchanged');
    });

    it('filters stderr to errStream when failOnStdErr is true', async function () {
        this.timeout(20000);
        const out = new Collector();
        const err = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stderr', 'task.complete]bye'));

        await assert.rejects(tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: err,
            failOnStdErr: true,
            externalOutput: { source: 'childProcess' }
        }));

        assert(err.text().indexOf('##_vso[task.complete]bye') >= 0);
        assert(err.text().indexOf('##vso[') < 0);
        assert(out.text().indexOf('##_vso[task.complete]bye') < 0);
    });

    it('does not display output in silent mode', async function () {
        this.timeout(20000);
        const out = new Collector();
        const err = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stdout', 'task.complete]hidden'));

        await tool.execAsync(<trm.IExecOptions>{
            outStream: out,
            errStream: err,
            silent: true,
            externalOutput: { source: 'childProcess' }
        });

        assert.strictEqual(out.text(), '');
        assert.strictEqual(err.text(), '');
    });

    it('execSync filters the displayed output but not the returned result', function () {
        this.timeout(20000);
        const out = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stdout', 'task.setvariable]hi'));

        const res = tool.execSync(<trm.IExecSyncOptions>{
            outStream: out,
            errStream: testutil.getNullStream(),
            externalOutput: { source: 'childProcess' }
        });

        assert(res.stdout.indexOf('##vso[task.setvariable') >= 0, 'returned stdout must be unchanged');
        assert(out.text().indexOf('##_vso[task.setvariable') >= 0, 'displayed stdout should be neutralized');
        assert(out.text().indexOf('##vso[') < 0, 'displayed stdout must not contain a live marker');
    });

    it('execSync filters displayed stderr to errStream', function () {
        this.timeout(20000);
        const out = new Collector();
        const err = new Collector();
        const tool = tl.tool(process.execPath).arg('-e').arg(printScript('stderr', 'task.complete]bye'));

        const result = tool.execSync(<trm.IExecSyncOptions>{
            outStream: out,
            errStream: err,
            externalOutput: { source: 'childProcess' }
        });

        assert(result.stderr.indexOf('##vso[task.complete]bye') >= 0);
        assert(err.text().indexOf('##_vso[task.complete]bye') >= 0);
        assert(err.text().indexOf('##vso[') < 0);
        assert(out.text().indexOf('##_vso[task.complete]bye') < 0);
    });
});
