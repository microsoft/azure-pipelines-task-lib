/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import psm = require('../lib/psRunner');
import path = require('path');
import fs = require('fs');
var shell = require('shelljs');
var ps = shell.which('powershell');
describe('VstsTaskSdk Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        fs.readdirSync(__dirname).forEach(function (file: string) {
            var ext = path.extname(file);
            if (ext.toLowerCase() == ".ps1") {
                it(path.basename(file, ext), (done) => {
                    psm.runPS(path.join(__dirname, file), done);
                })
            }
        });
    }
});