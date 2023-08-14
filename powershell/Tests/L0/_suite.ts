/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import psRunner = require('../lib/psRunner');
import path = require('path');
import fs = require('fs');
let shell = require('shelljs');
let ps: string = shell.which('powershell.exe');
describe('VstsTaskSdk Suite', function () {
    this.timeout(20000);

    before((done: MochaDone): void => {
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
                it(description, (done: MochaDone) => {
                    psRunner.run(fullPath, done);
                });
            }
        });
    }
});