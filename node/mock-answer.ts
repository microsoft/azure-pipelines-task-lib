import path = require('path');
import fs = require('fs');

export interface TaskLibAnswerExecResult {
    code: number,
    stdout?: string,
    stderr?: string
}

export interface TaskLibAnswers {
    which?: { [key: string]: string; },
    exec?: { [ key: string]: TaskLibAnswerExecResult },
    checkPath?: { [key: string]: boolean },
    exist?: { [key: string]: boolean },
    find?: { [key: string]: string[] },
    findMatch?: { [key: string]: string[] },
    rmRF?: { [key: string]: { success: boolean } },
}

export class MockAnswers {
    private _answers: TaskLibAnswers;

    public initialize(answers: TaskLibAnswers) {
        if (!answers) {
            throw new Error('Answers not supplied');
        }
        this._answers = answers;
    }

    public getResponse<T extends keyof TaskLibAnswers, K extends keyof TaskLibAnswers[T]>(
        cmd: T,
        key: K,
        debug: (message: string) => void
    ): TaskLibAnswers[T][K] {
        debug(`looking up mock answers for ${JSON.stringify(cmd)}, key '${JSON.stringify(key)}'`);
        if (!this._answers) {
            throw new Error('Must initialize');
        }

        if (!this._answers[cmd]) {
            debug(`no mock responses registered for given cmd`);
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
