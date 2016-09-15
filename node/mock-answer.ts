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
    match?: { [key: string]: string[] },
    getVariable?: { [key: string]: string; }
}

export class MockAnswers {
    private _answers: TaskLibAnswers;

    public initialize(answers: TaskLibAnswers) {
        if (!answers) {
            throw new Error('Answers not supplied');
        }
        this._answers = answers;
    }

    public getResponse(cmd: string, key: string): any {
        if (!this._answers) {
            throw new Error('Must initialize');
        }

        if (!this._answers[cmd]) {
            return null;
        }

        if (!this._answers[cmd][key] && key && process.env['MOCK_NORMALIZE_SLASHES'] === 'true') {
            // try normalizing the slashes
            var key2 = key.replace(/\\/g, "/");
            if (this._answers[cmd][key2]) {
                return this._answers[cmd][key2];
            }
        }

        return this._answers[cmd][key];
    }
}
