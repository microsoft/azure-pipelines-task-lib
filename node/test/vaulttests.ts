// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import crypto = require('crypto');
import fs = require('fs');
import * as vm from '../_build/vault';
import * as trm from '../_build/toolrunner';

import testutil = require('./testutil');

describe('Vault Tests', function () {

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

    it('Can create vault', function (done) {
        var vault: vm.Vault = new vm.Vault(process.cwd());

        assert(vault, 'should have created a vault object');

        done();
    })
    it('Can create vault when randomUUID is unavailable', function () {
        var originalRandomUUID = crypto.randomUUID;
        try {
            (crypto as any).randomUUID = undefined;
            var vault: vm.Vault = new vm.Vault(process.cwd());
            var key = fs.readFileSync('.taskkey', 'utf8');
            assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key));
            assert(vault.storeSecret('name', 'value'));
            assert.equal(vault.retrieveSecret('name'), 'value');
        }
        finally {
            (crypto as any).randomUUID = originalRandomUUID;
        }
    })
    it('Can store and retrieve a basic value', function (done) {
        var vault: vm.Vault = new vm.Vault(process.cwd());
        var data = "astring";
        var name = "mystring";
        var stored: boolean = vault.storeSecret(name, data);
        assert(stored, "should have returned stored");

        var ret = vault.retrieveSecret(name);

        assert.equal(data, ret, 'should have retrieved the same string');

        done();
    })
    it('Stores and retrieves using case-insenstive key comparison', function (done) {
        var vault: vm.Vault = new vm.Vault(process.cwd());
        var data = "astring";
        var storageName = "MYstring";
        var retrievalName = "mySTRING";
        var stored: boolean = vault.storeSecret(storageName, data);
        assert(stored, "should have returned stored");

        var ret = vault.retrieveSecret(retrievalName);

        assert.equal(data, ret, 'should have retrieved the same string');

        done();
    })
    it('Returns null when retrieving non-existant item', function (done) {
        var vault: vm.Vault = new vm.Vault(process.cwd());
        var name = "nonexistant";
        var ret = vault.retrieveSecret(name);

        assert(!ret, 'should have returned null for non-existant item');

        done();
    })
    it('Will return false if you store null', function (done) {
        var vault: vm.Vault = new vm.Vault(process.cwd());
        var name = "nullitem";
        var stored: boolean = vault.storeSecret(name, null);
        assert(!stored, "should not have stored a null");

        var ret = vault.retrieveSecret(name);
        assert(!ret, 'should have returned null for non-existant item');

        done();
    })
    it('Will return false if you store empty string', function (done) {
        var vault: vm.Vault = new vm.Vault(process.cwd());
        var name = "nullitem";
        var stored: boolean = vault.storeSecret(name, "");
        assert(!stored, "should not have stored a null");

        var ret = vault.retrieveSecret(name);
        assert(!ret, 'should have returned null for non-existant item');

        done();
    })
});
