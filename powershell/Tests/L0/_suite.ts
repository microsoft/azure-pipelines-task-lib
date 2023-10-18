import * as psRunner from '../lib/psRunner';
import path from 'path';
import fs from 'fs';
import shell from 'shelljs';

const ps = shell.which('powershell.exe')?.stdout;

describe('VstsTaskSdk Suite', function () {
    this.timeout(20000);

    before((done: Mocha.Done): void => {
        done();
    });

    after((): void => {
        psRunner.ensureStopped();
    });

    if (ps) {
        fs.readdirSync(__dirname).forEach((file: string) => {
            let fullPath: string = path.join(__dirname, file);
            if (file.match(/\.ps1$/)) {
                let description: string = path.basename(file, '.ps1');
                it(description, (done: Mocha.Done) => {
                    psRunner.run(fullPath, done);
                });
            }
        });
    }
});