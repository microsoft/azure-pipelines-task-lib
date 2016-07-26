/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import psRunner = require('../lib/psRunner');
import path = require('path');
import fs = require('fs');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
describe('VstsTaskSdk Suite', function () {
    this.timeout(20000);

    before((done) => {
        done();
    });

    after(() => {
        psRunner.ensureStopped();
    });

    if (ps) {
        fs.readdirSync(__dirname).forEach((file: string) => {
            let fullPath = path.join(__dirname, file);
            if (file.match(/.ps1$/)) {
                let description: string = path.basename(file, '.ps1');
                it(description, (done) => {
                    psRunner.run(fullPath, done);
                });
            }
        });
    }
});