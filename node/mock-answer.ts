import path = require('path');
import fs = require('fs');

export class MockAnswers {
    private _answerFile: string;
    private _answers: any;

    public initialize(answerFile: string) {
        this._answerFile = answerFile;

        if (!answerFile || !fs.existsSync(answerFile)) {
            throw new Error('Answer file not found: ' + answerFile);
        }
        this._answers = require(answerFile);
    }

    public getResponse(cmd: string, key: string): any {
        if (!this._answerFile) {
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
