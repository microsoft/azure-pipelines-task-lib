// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import stream = require('stream');

//
// External output filtering.
//
// Azure Pipelines treats a task's stdout both as log text and as a command channel:
// a line containing the marker "##vso[area.event ...]data" is parsed and executed by the
// agent. When a task echoes output that originates from an untrusted source (a remote
// server, a child process, a repository filename, compiler/test output, ...), that source
// can smuggle a "##vso[" marker and make the agent run a command on its behalf.
//
// This module neutralizes markers in such external output before it reaches the agent's
// command parser. By default every marker is blocked (rewritten "##vso[" -> "##_vso[").
// A task may opt a compatibility-sensitive path into a small, explicit allowlist of
// command names; unknown, malformed, or future commands stay blocked.
//
// The filter works on raw bytes (Buffer) so it never corrupts invalid UTF-8, binary
// output, or multibyte characters split across chunk boundaries. It matches the marker
// byte-for-byte, mirroring the agent's Ordinal comparison, so the two agree exactly on
// what a marker is.
//

/** The exact marker bytes the agent recognizes as the start of a command: "##vso[". */
const MARKER: Buffer = Buffer.from('##vso[', 'ascii');

/** Neutralized form written in place of a blocked marker: "##_vso[". */
const NEUTRALIZED: Buffer = Buffer.from('##_vso[', 'ascii');

const EMPTY: Buffer = Buffer.alloc(0);

const SPACE = 0x20;
const RBRACKET = 0x5D; // ]
const CR = 0x0D;
const LF = 0x0A;

// Maximum command-name bytes retained while waiting for a terminator.
const MAX_HEADER = 256;

/** Commands allowed by default once VSO commands are enabled for a path. */
export const defaultAllowedVsoCommands: readonly string[] = Object.freeze(['task.debug', 'task.setprogress']);

/**
 * Where the external output originates. Used for documentation and telemetry only; it does
 * NOT select an automatic allowlist. A task must explicitly enable VSO commands when needed.
 */
export type ExternalOutputSource = 'remote' | 'childProcess' | 'repository';

export interface ExternalOutputOptions {
    /** Origin of the output. Documentation/telemetry only. */
    source: ExternalOutputSource;

    /**
     * When false or omitted, every "##vso[" marker is blocked. When true, markers whose
     * command name is in the effective allowlist pass through unchanged.
     */
    enableVsoCommands?: boolean;

    /**
     * The allowlist of "area.event" command names to permit when enableVsoCommands is true.
     * Replaces (does not extend) the default list. An explicit empty array allows nothing.
     * Has no effect when enableVsoCommands is false.
     */
    allowedVsoCommands?: readonly string[];

    /** Destination for filtered output. Defaults to process.stdout. */
    destination?: NodeJS.WritableStream;
}

function resolveAllowed(options: ExternalOutputOptions): Set<string> {
    if (!options.enableVsoCommands) {
        return new Set<string>();
    }
    const list = options.allowedVsoCommands !== undefined
        ? options.allowedVsoCommands
        : defaultAllowedVsoCommands;
    // Command-name comparison is case-insensitive to match the agent's command lookup.
    return new Set<string>(list.map((c) => c.toLowerCase()));
}

/**
 * Normalizes a raw command-name token to the agent's canonical "area.event" form, or null
 * when it is not a valid command name. Mirrors the agent's Split('.', RemoveEmptyEntries)
 * with a required length of exactly two non-empty segments.
 */
function canonicalCommandName(raw: string): string | null {
    const parts = raw.split('.').filter((p) => p.length > 0);
    if (parts.length !== 2) {
        return null;
    }
    return (parts[0] + '.' + parts[1]).toLowerCase();
}

/** Returns the longest suffix of buf that is a proper marker prefix. */
function partialMarkerSuffixLength(buf: Buffer): number {
    const max = Math.min(MARKER.length - 1, buf.length);
    for (let k = max; k >= 1; k--) {
        if (buf.compare(MARKER, 0, k, buf.length - k, buf.length) === 0) {
            return k;
        }
    }
    return 0;
}

/**
 * Locates the end of a command-name header that starts at `start` (the byte after a marker).
 * The name ends at the first space or ']'. A CR or LF is also reported as a terminator with
 * newline=true so the caller can fail closed. Scans at most MAX_HEADER bytes; term is -1 when
 * no terminator is found within that bound (or before the buffer ends).
 */
function scanHeader(buf: Buffer, start: number): { term: number; newline: boolean } {
    const limit = Math.min(buf.length, start + MAX_HEADER);
    for (let k = start; k < limit; k++) {
        const b = buf[k];
        if (b === SPACE || b === RBRACKET) {
            return { term: k, newline: false };
        }
        if (b === CR || b === LF) {
            return { term: k, newline: true };
        }
    }
    return { term: -1, newline: false };
}

/**
 * Stateful, byte-level marker filter. Feed bytes with push() and finish with flush().
 * Retains only the minimal bytes needed to resolve a marker that straddles a chunk
 * boundary, so memory stays bounded regardless of input size.
 */
export class MarkerFilter {
    private pending: Buffer = EMPTY;

    constructor(private readonly enabled: boolean, private readonly allowed: Set<string>) {}

    public push(chunk: Buffer): Buffer {
        let buf = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
        this.pending = EMPTY;

        const out: Buffer[] = [];
        let pos = 0;

        while (pos < buf.length) {
            const idx = buf.indexOf(MARKER, pos);

            if (idx === -1) {
                // No complete marker remains. Retain a possible partial marker at the tail so
                // it can be completed by the next chunk; emit everything before it.
                const keep = Math.min(partialMarkerSuffixLength(buf), buf.length - pos);
                const emitEnd = buf.length - keep;
                if (emitEnd > pos) {
                    out.push(pos === 0 && emitEnd === buf.length ? buf : buf.subarray(pos, emitEnd));
                }
                this.pending = keep ? buf.subarray(buf.length - keep) : EMPTY;
                break;
            }

            if (idx > pos) {
                out.push(buf.subarray(pos, idx));
            }

            const afterMarker = idx + MARKER.length;

            if (!this.enabled) {
                out.push(NEUTRALIZED);
                pos = afterMarker;
                continue;
            }

            // Enabled: read the command name (up to the first space or ']') and allow the marker
            // only when that name is allowlisted.
            const { term, newline } = scanHeader(buf, afterMarker);

            if (term === -1) {
                if (buf.length - afterMarker >= MAX_HEADER) {
                    // No terminator within the bound: fail closed.
                    out.push(NEUTRALIZED);
                    pos = afterMarker;
                    continue;
                }
                // Header may complete in a later chunk; retain from the marker start.
                this.pending = buf.subarray(idx);
                break;
            }

            // A CR/LF before the terminator means the agent (which parses per line) would never
            // treat this as a command, so we fail closed and neutralize.
            if (newline) {
                out.push(NEUTRALIZED);
                pos = afterMarker;
                continue;
            }

            const name = canonicalCommandName(buf.toString('utf8', afterMarker, term));
            // Allowlisted markers pass unchanged; the header/data after them flow through as
            // ordinary bytes and any later markers are evaluated independently.
            out.push(name && this.allowed.has(name) ? MARKER : NEUTRALIZED);
            pos = afterMarker;
        }

        if (out.length === 0) {
            return EMPTY;
        }
        if (out.length === 1) {
            const only = out[0];
            // Never expose module-level buffers that callers could mutate globally.
            return only === NEUTRALIZED || only === MARKER ? Buffer.from(only) : only;
        }
        return Buffer.concat(out);
    }

    public flush(): Buffer {
        const p = this.pending;
        this.pending = EMPTY;
        if (p.length === 0) {
            return EMPTY;
        }
        // An incomplete command candidate that begins with the full marker is neutralized.
        if (this.enabled && p.length >= MARKER.length && p.subarray(0, MARKER.length).equals(MARKER)) {
            return Buffer.concat([NEUTRALIZED, p.subarray(MARKER.length)]);
        }
        // A partial marker (fewer than the full bytes) cannot be executed by the agent, so it
        // is safe to emit unchanged.
        return p;
    }
}

/**
 * A Transform stream that neutralizes VSO command markers in external output. Pipe untrusted
 * output into it; it writes filtered bytes to its readable side (and, via
 * createExternalOutputStream, on to the destination).
 */
export class ExternalOutputStream extends stream.Transform {
    private readonly markerFilter: MarkerFilter;

    constructor(options: ExternalOutputOptions) {
        super();
        this.markerFilter = new MarkerFilter(!!options.enableVsoCommands, resolveAllowed(options));
    }

    _transform(chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
        try {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
            const out = this.markerFilter.push(buf);
            if (out.length) {
                this.push(out);
            }
            callback();
        } catch (err) {
            // Fail closed: never recover by emitting the original marker.
            callback(err as Error);
        }
    }

    _flush(callback: (error?: Error | null) => void): void {
        try {
            const out = this.markerFilter.flush();
            if (out.length) {
                this.push(out);
            }
            callback();
        } catch (err) {
            callback(err as Error);
        }
    }
}

/**
 * Creates a filtering stream for external output and pipes it to the destination
 * (default process.stdout). Pipe untrusted output into the returned stream, e.g.
 * `jenkinsResponse.pipe(tl.createExternalOutputStream({ source: 'remote' }))`.
 */
export function createExternalOutputStream(options: ExternalOutputOptions): ExternalOutputStream {
    const filterStream = new ExternalOutputStream(options);
    const destination = options.destination || process.stdout;
    // Do not end the shared destination (e.g. process.stdout) when the source ends.
    filterStream.pipe(destination, { end: false });
    return filterStream;
}

/**
 * Filters a complete piece of external output and writes it to the destination
 * (default process.stdout). Each call is self-contained; for output that arrives in
 * chunks that may split a marker, use createExternalOutputStream instead.
 */
export function writeExternalOutput(data: string | Buffer, options: ExternalOutputOptions): void {
    const destination = options.destination || process.stdout;
    destination.write(filterExternalOutput(data, options));
}

/** Filters one complete value and returns its bytes without writing them. */
export function filterExternalOutput(data: string | Buffer, options: ExternalOutputOptions): Buffer {
    const filter = new MarkerFilter(!!options.enableVsoCommands, resolveAllowed(options));
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    const filtered = filter.push(buf);
    const pending = filter.flush();
    return pending.length ? Buffer.concat([filtered, pending]) : filtered;
}

export interface FilteredWriter {
    write(data: string | Buffer): void;
    end(): void;
}

/** Creates a stateful writer that filters markers split across writes. */
export function createFilteredWriter(options: ExternalOutputOptions, destination: NodeJS.WritableStream): FilteredWriter {
    const filter = new MarkerFilter(!!options.enableVsoCommands, resolveAllowed(options));
    let ended = false;

    return {
        write(data: string | Buffer): void {
            if (ended) {
                throw new Error('Cannot write after end');
            }
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
            const filtered = filter.push(buf);
            if (filtered.length) {
                destination.write(filtered);
            }
        },
        end(): void {
            if (ended) {
                return;
            }
            ended = true;
            const pending = filter.flush();
            if (pending.length) {
                destination.write(pending);
            }
        }
    };
}
