import * as path from 'path';
import * as fs from 'fs';

export interface TaskLibAnswerExecResult {
    code: number,
    stdout?: string,
    stderr?: string
}

export interface TaskLibAnswers {
    checkPath?: { [key: string]: boolean },
    cwd?: { [key: string]: string },
    exec?: { [ key: string]: TaskLibAnswerExecResult },
    exist?: { [key: string]: boolean },
    find?: { [key: string]: string[] },
    findMatch?: { [key: string]: string[] },
    ls?: { [key: string]: string },
    osType?: { [key: string]: string },
    rmRF?: { [key: string]: { success: boolean } },
    stats?: { [key: string]: any }, // Can't use `fs.Stats` as most existing uses don't mock all required properties
    which?: { [key: string]: string },
}

export type MockedCommand = keyof TaskLibAnswers;

export class MockAnswers {
    private _answers: TaskLibAnswers | undefined;

    public initialize(answers: TaskLibAnswers) {
        if (!answers) {
            throw new Error('Answers not supplied');
        }
        this._answers = answers;
    }

    public getResponse(cmd: MockedCommand, key: string, debug: (message: string) => void): any {
        debug(`looking up mock answers for ${JSON.stringify(cmd)}, key '${JSON.stringify(key)}'`);
        if (!this._answers) {
            throw new Error('Must initialize');
        }

        if (!this._answers[cmd]) {
            debug(`no mock responses registered for ${JSON.stringify(cmd)}`);
            return null;
        }

        if (this._answers[cmd][key]) {
            debug('found mock response');
            return this._answers[cmd][key];
        }

        if (key && process.env['MOCK_NORMALIZE_SLASHES'] === 'true') {
            // try normalizing the slashes
            var key2 = key.replace(/\\/g, "/");
            if (this._answers[cmd][key2]) {
                debug('found mock response for normalized key');
                return this._answers[cmd][key2];
            }
        }

        debug('mock response not found');
        return null;
    }
}
