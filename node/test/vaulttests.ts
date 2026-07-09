// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');

import * as vm from '../_build/vault';
import testutil = require('./testutil');

describe('Vault Tests', function () {
    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        done();
    });


    it('Can create vault', function (done) {
        const vault = new vm.Vault(process.cwd());

        assert(vault, 'should have created a vault object');

        done();
    });

    it('Can store and retrieve a basic value', function (done) {
        const vault = new vm.Vault(process.cwd());
        const data = "astring";
        const name = "mystring";
        const stored = vault.storeSecret(name, data);
        assert(stored, "should have returned stored");

        const ret = vault.retrieveSecret(name);

        assert.equal(data, ret, 'should have retrieved the same string');

        done();
    });

    it('Stores and retrieves using case-insenstive key comparison', function (done) {
        const vault = new vm.Vault(process.cwd());
        const data = "astring";
        const storageName = "MYstring";
        const retrievalName = "mySTRING";
        const stored = vault.storeSecret(storageName, data);
        assert(stored, "should have returned stored");

        const ret = vault.retrieveSecret(retrievalName);

        assert.equal(data, ret, 'should have retrieved the same string');

        done();
    });

    it('Returns null when retrieving non-existant item', function (done) {
        const vault = new vm.Vault(process.cwd());
        const name = "nonexistant";
        const ret = vault.retrieveSecret(name);

        assert(!ret, 'should have returned null for non-existant item');

        done();
    });

    it('Will return false if you store null', function (done) {
        const vault = new vm.Vault(process.cwd());
        const name = "nullitem";
        // @ts-ignore we are testing the behavior of passing null, so we ignore the type error here
        const stored = vault.storeSecret(name, null);
        assert(!stored, "should not have stored a null");

        const ret = vault.retrieveSecret(name);
        assert(!ret, 'should have returned null for non-existant item');

        done();
    });

    it('Will return false if you store empty string', function (done) {
        const vault = new vm.Vault(process.cwd());
        const name = "nullitem";
        const stored = vault.storeSecret(name, "");
        assert(!stored, "should not have stored a null");

        const ret = vault.retrieveSecret(name);
        assert(!ret, 'should have returned null for non-existant item');

        done();
    });
});
