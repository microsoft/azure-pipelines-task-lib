// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Is UNC-path Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {
    });

    it('checks if path is unc path', (done: MochaDone) => {
        this.timeout(1000);

        const paths = [
            { str: '\\server\\path\\to\\file', unc: false },
            { str: '\\\\server\\path\\to\\file', unc: true },
            { str: '\\\\\\server\\path\\to\\file', unc: false },
            { str: '!@#$%^&*()_+', unc: false },
            { str: '\\\\\\\\\\\\', unc: false },
            { str: '1q2w3e4r5t6y', unc: false },
            { str: '', unc: false }
        ];

        for (let path of paths) {
            assert.deepEqual(tl.isUncPath(path.str), path.unc);
        }

        done();
    });
});
