// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import stream = require('stream');
import * as eom from '../_build/externaloutput';

// Runs a sequence of string/Buffer chunks through a fresh MarkerFilter and returns the
// concatenated filtered output as a UTF-8 string. Splitting the input into multiple chunks
// exercises the split-marker retention logic.
function run(chunks: (string | Buffer)[], enabled?: boolean, allowed?: readonly string[]): string {
    const set = new Set<string>((allowed || []).map((c) => c.toLowerCase()));
    const filter = new eom.MarkerFilter(!!enabled, set);
    const out: Buffer[] = [];
    for (const c of chunks) {
        const buf = Buffer.isBuffer(c) ? c : Buffer.from(c, 'utf8');
        out.push(filter.push(buf));
    }
    out.push(filter.flush());
    return Buffer.concat(out).toString('utf8');
}

// Every prefix length from 1..N-1 as a separate chunk boundary, to prove the marker is caught
// no matter where a write splits it.
function allSplits(input: string): string[] {
    const results: string[] = [];
    for (let i = 1; i < input.length; i++) {
        results.push(run([input.slice(0, i), input.slice(i)]));
    }
    return results;
}

describe('External Output Filter', function () {

    describe('disabled (block-all default)', function () {
        it('neutralizes a single marker', function () {
            assert.strictEqual(
                run(['##vso[task.complete result=Succeeded]done']),
                '##_vso[task.complete result=Succeeded]done');
        });

        it('neutralizes every marker on a line', function () {
            assert.strictEqual(
                run(['one ##vso[task.debug]a two ##vso[task.complete]b']),
                'one ##_vso[task.debug]a two ##_vso[task.complete]b');
        });

        it('leaves ordinary text unchanged', function () {
            assert.strictEqual(run(['just some log text\nwith a newline']), 'just some log text\nwith a newline');
        });

        it('returns a marker-free buffer without copying it', function () {
            const input = Buffer.from('ordinary output');
            const filter = new eom.MarkerFilter(false, new Set<string>());
            assert.strictEqual(filter.push(input), input);
        });

        it('does not expose shared marker buffers to callers', function () {
            const options: eom.ExternalOutputOptions = { source: 'repository' };
            const first = eom.filterExternalOutput('##vso[', options);
            const second = eom.filterExternalOutput('##vso[', options);

            assert.notStrictEqual(first, second);
            first.write('##_zzz[');
            assert.strictEqual(eom.filterExternalOutput('##vso[', options).toString('utf8'), '##_vso[');
        });

        it('does not match wrong case or near-misses', function () {
            assert.strictEqual(run(['##VSO[task.debug] ##vs0[x] #vso[y]']), '##VSO[task.debug] ##vs0[x] #vso[y]');
        });

        it('catches a marker no matter where the chunk boundary falls', function () {
            for (const r of allSplits('pre ##vso[task.complete]post')) {
                assert.strictEqual(r, 'pre ##_vso[task.complete]post');
            }
        });

        it('emits an incomplete partial marker at EOF unchanged', function () {
            // "##vs" can never be a command, so it is safe to flush as-is.
            assert.strictEqual(run(['trailing ##vs']), 'trailing ##vs');
        });

        it('retains only a minimal tail, emitting earlier bytes promptly', function () {
            assert.strictEqual(run(['log ##v', 'so[task.setvariable x=y]z']), 'log ##_vso[task.setvariable x=y]z');
        });

        it('preserves pending marker bytes across an empty chunk', function () {
            assert.strictEqual(run(['log ##v', '', 'so[task.complete]x']), 'log ##_vso[task.complete]x');
        });
    });

    describe('enabled with default allowlist', function () {
        const allow = eom.defaultAllowedVsoCommands;

        it('cannot be widened by mutating the exported defaults', function () {
            assert.throws(() => (allow as string[]).push('task.setvariable'), TypeError);
            assert.deepStrictEqual(allow, ['task.debug', 'task.setprogress']);
        });

        it('passes task.debug and task.setprogress unchanged', function () {
            assert.strictEqual(run(['##vso[task.debug]hi'], true, allow), '##vso[task.debug]hi');
            assert.strictEqual(run(['##vso[task.setprogress value=50]'], true, allow), '##vso[task.setprogress value=50]');
        });

        it('blocks state-changing commands not in the allowlist', function () {
            assert.strictEqual(run(['##vso[task.setvariable var=x]'], true, allow), '##_vso[task.setvariable var=x]');
            assert.strictEqual(run(['##vso[task.complete result=Failed]'], true, allow), '##_vso[task.complete result=Failed]');
            assert.strictEqual(run(['##vso[task.logissue type=error]x'], true, allow), '##_vso[task.logissue type=error]x');
        });

        it('evaluates each marker independently', function () {
            assert.strictEqual(
                run(['one ##vso[task.debug]a two ##vso[task.complete]b'], true, allow),
                'one ##vso[task.debug]a two ##_vso[task.complete]b');
        });

        it('accepts a space or ] as the command-name terminator', function () {
            assert.strictEqual(run(['##vso[task.debug]x'], true, allow), '##vso[task.debug]x');
            assert.strictEqual(run(['##vso[task.debug ]x'], true, allow), '##vso[task.debug ]x');
        });

        it('is case-insensitive on the command name', function () {
            assert.strictEqual(run(['##vso[TASK.Debug]x'], true, allow), '##vso[TASK.Debug]x');
        });

        it('normalizes empty segments like the agent (task..debug -> task.debug)', function () {
            assert.strictEqual(run(['##vso[task..debug]x'], true, allow), '##vso[task..debug]x');
        });

        it('blocks malformed names with the wrong segment count', function () {
            assert.strictEqual(run(['##vso[task]x'], true, allow), '##_vso[task]x');
            assert.strictEqual(run(['##vso[a.b.c]x'], true, allow), '##_vso[a.b.c]x');
        });

        it('fails closed when a newline precedes the terminator', function () {
            assert.strictEqual(run(['##vso[task.debug\n]x'], true, allow), '##_vso[task.debug\n]x');
            assert.strictEqual(run(['##vso[task.debug\r\n]x'], true, allow), '##_vso[task.debug\r\n]x');
        });

        it('neutralizes an allowed-looking marker that never terminates its header', function () {
            const longHeader = 'a'.repeat(400);
            assert.strictEqual(run([`##vso[${longHeader}`], true, allow), `##_vso[${longHeader}`);
        });

        it('accepts a terminator within the header bound and blocks one beyond it', function () {
            const withinBound = `task.${'d'.repeat(250)}`;
            const beyondBound = `task.${'d'.repeat(251)}`;
            assert.strictEqual(run([`##vso[${withinBound}]x`], true, [withinBound]), `##vso[${withinBound}]x`);
            assert.strictEqual(run([`##vso[${beyondBound}]x`], true, [beyondBound]), `##_vso[${beyondBound}]x`);
        });

        it('neutralizes an incomplete command candidate at EOF', function () {
            assert.strictEqual(run(['##vso[task.deb'], true, allow), '##_vso[task.deb');
        });

        it('catches allow/block decisions across every chunk split', function () {
            const blocked = 'x ##vso[task.setvariable a=b]y';
            for (let i = 1; i < blocked.length; i++) {
                assert.strictEqual(run([blocked.slice(0, i), blocked.slice(i)], true, allow), 'x ##_vso[task.setvariable a=b]y');
            }

            const allowed = 'x ##vso[task.debug]y';
            for (let i = 1; i < allowed.length; i++) {
                assert.strictEqual(run([allowed.slice(0, i), allowed.slice(i)], true, allow), allowed);
            }
        });
    });

    describe('enabled with explicit allowlist', function () {
        it('replaces (does not extend) the default list', function () {
            // task.debug is in the default but NOT in this explicit list -> blocked.
            assert.strictEqual(run(['##vso[task.debug]x'], true, ['task.logissue']), '##_vso[task.debug]x');
            assert.strictEqual(run(['##vso[task.logissue]x'], true, ['task.logissue']), '##vso[task.logissue]x');
        });

        it('treats an explicit empty array as allow-nothing', function () {
            assert.strictEqual(run(['##vso[task.debug]x'], true, []), '##_vso[task.debug]x');
        });
    });

    describe('binary and multibyte safety', function () {
        it('passes non-marker binary bytes through untouched', function () {
            const bin = Buffer.from([0x00, 0xff, 0xfe, 0x80, 0x23, 0x23]); // ends with "##"
            const filter = new eom.MarkerFilter(false, new Set<string>());
            const out = Buffer.concat([filter.push(bin), filter.flush()]);
            assert.deepStrictEqual(out, bin);
        });

        it('does not corrupt a multibyte character split across chunks', function () {
            // U+00E9 (é) is 0xC3 0xA9 in UTF-8; split the two bytes across writes.
            const filter = new eom.MarkerFilter(false, new Set<string>());
            const a = filter.push(Buffer.from([0x63, 0xc3])); // "c" + first byte of é
            const b = filter.push(Buffer.from([0xa9, 0x64])); // second byte of é + "d"
            const out = Buffer.concat([a, b, filter.flush()]);
            assert.strictEqual(out.toString('utf8'), 'céd');
        });
    });

    describe('ExternalOutputStream / writeExternalOutput', function () {
        it('filters piped output to a destination stream', function (done) {
            const sink = new stream.PassThrough();
            const collected: Buffer[] = [];
            sink.on('data', (d) => collected.push(d));
            const s = eom.createExternalOutputStream({ source: 'remote', destination: sink });
            s.on('end', () => {
                assert.strictEqual(Buffer.concat(collected).toString('utf8'), 'r ##_vso[task.complete]x');
                done();
            });
            s.write(Buffer.from('r ##vso[task.'));
            s.write(Buffer.from('complete]x'));
            s.end();
        });

        it('writeExternalOutput filters a one-shot write to a destination', function () {
            const sink = new stream.PassThrough();
            let got = '';
            sink.on('data', (d) => { got += d.toString('utf8'); });
            eom.writeExternalOutput('a ##vso[task.setvariable x=1]b', { source: 'repository', destination: sink });
            assert.strictEqual(got, 'a ##_vso[task.setvariable x=1]b');
        });

        it('filterExternalOutput handles incomplete markers as a complete value', function () {
            const output = eom.filterExternalOutput('a ##vso[task.deb', {
                source: 'repository',
                enableVsoCommands: true
            });
            assert.strictEqual(output.toString('utf8'), 'a ##_vso[task.deb');
        });

        it('createFilteredWriter filters markers split across writes and flushes once', function () {
            const sink = new stream.PassThrough();
            let got = '';
            sink.on('data', (d) => { got += d.toString('utf8'); });
            const writer = eom.createFilteredWriter({ source: 'childProcess' }, sink);
            writer.write('a ##v');
            writer.write('so[task.complete]b ##vs');
            writer.end();
            writer.end();
            assert.strictEqual(got, 'a ##_vso[task.complete]b ##vs');
            assert.throws(() => writer.write('late'), /Cannot write after end/);
        });
    });
});
