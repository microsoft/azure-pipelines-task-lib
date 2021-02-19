// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as tmrm from '../_build/mock-run';
import * as path from 'path';
// import testutil = require('./testutil');

describe('Result Tests', function () {

    before(function () {
    });

    after(function () {

    });

    it('gets variable created with setVariableName', function (done) {
        this.timeout(5000);

        var task_path = path.join(__dirname, 'scripts/index.js');
        let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(task_path);
        tmr.setVariableName('foo', 'bar', false);

        tmr.run(true)


        done();
    })
});
