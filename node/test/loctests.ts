// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');

import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Loc Tests', function () {
    beforeEach(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        done();
    });

    it('validate loc string key in lib.json', function (done) {
        this.timeout(1000);

        const jsonPath = path.join(__dirname, '../lib.json');
        const json = require(jsonPath);

        if (json && json.hasOwnProperty('messages')) {
            for (const key in json.messages) {
                assert(key.search(/\W+/gi) < 0, ('messages key: \'' + key + '\' contain non-word characters, only allows [a-zA-Z0-9_].'));
                assert(key.search(/^LIB_/) === 0, ('messages key: \'' + key + '\' should start with \'LIB_\'.'));

                if (typeof (json.messages[key]) === 'object') {
                    assert(false, ('messages key: \'' + key + '\' should have a loc string, not a object.'));
                } else if (typeof (json.messages[key]) === 'string') {
                    assert(json.messages[key].toString().length > 0, ('messages key: \'' + key + '\' should have a loc string.'));
                }
            }
        }

        done();
    })
    it('get loc string from loc resources.json', function (done) {
        this.timeout(1000);

        const tempFolder = path.join(testutil.getTestTemp(), 'loc-str-from-loc-res-json');
        shell.mkdir('-p', tempFolder);
        const jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
        const jsonPath = path.join(tempFolder, 'task.json');
        fs.writeFileSync(jsonPath, jsonStr);

        const tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'zh-CN');
        shell.mkdir('-p', tempLocFolder);
        const locJsonStr = "{\"loc.messages.key1\" : \"loc cn-string for key 1.\", \"loc.messages.key2\" : \"loc cn-string for key %d.\", \"loc.messages.key3\" : \"loc cn-string for key %%.\"}";
        const locJsonPath = path.join(tempLocFolder, 'resources.resjson');
        fs.writeFileSync(locJsonPath, locJsonStr);

        process.env['SYSTEM_CULTURE'] = 'ZH-cn'; // Lib should handle casing differences for culture.

        tl.setResourcePath(jsonPath);

        assert.equal(tl.loc('key1'), 'loc cn-string for key 1.', 'string not found for key.');
        assert.equal(tl.loc('key2', 2), 'loc cn-string for key 2.', 'string not found for key.');
        assert.equal(tl.loc('key3'), 'loc cn-string for key %%.', 'string not found for key.');

        done();
    })
    it('gets loc string from second loc resources.json', function (done) {
        this.timeout(1000);

        // Don't reset values each time we call setResourcesPath for this test.
        process.env['TASKLIB_INPROC_UNITS'] = '';

        // Arrange
        const tempFolder = path.join(testutil.getTestTemp(), 'loc-str-from-loc-res-json2');
        shell.mkdir('-p', tempFolder);

        // Create first task.json and resources file
        const jsonStr = "{\"messages\": {\"key6\" : \"string for key 6.\"}}";
        const jsonPath = path.join(tempFolder, 'task.json');
        fs.writeFileSync(jsonPath, jsonStr);

        const tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'zh-CN');
        shell.mkdir('-p', tempLocFolder);
        const locJsonStr = "{\"loc.messages.key6\" : \"loc cn-string for key 6.\"}";
        const locJsonPath = path.join(tempLocFolder, 'resources.resjson');
        fs.writeFileSync(locJsonPath, locJsonStr);

        // Create second task.json and resources file
        const nestedLocFolder = path.join(tempFolder, 'nested');
        shell.mkdir('-p', nestedLocFolder);

        const jsonStr2 = "{\"messages\": {\"keySecondFile\" : \"string for keySecondFile.\"}}";
        const jsonPath2 = path.join(nestedLocFolder, 'task.json');
        fs.writeFileSync(jsonPath2, jsonStr2);

        const tempLocFolder2 = path.join(nestedLocFolder, 'Strings', 'resources.resjson', 'zh-CN');
        shell.mkdir('-p', tempLocFolder2);
        const locJsonStr2 = "{\"loc.messages.keySecondFile\" : \"loc cn-string for keySecondFile.\"}";
        const locJsonPath2 = path.join(tempLocFolder2, 'resources.resjson');
        fs.writeFileSync(locJsonPath2, locJsonStr2);

        process.env['SYSTEM_CULTURE'] = 'ZH-cn'; // Lib should handle casing differences for culture.

        // Act
        tl.setResourcePath(jsonPath);
        tl.setResourcePath(jsonPath2);

        // Assert
        assert.equal(tl.loc('key6'), 'loc cn-string for key 6.', 'string not found for key.');
        assert.equal(tl.loc('keySecondFile'), 'loc cn-string for keySecondFile.', 'string not found for keySecondFile.');

        done();
    })

    it('fallback to current string if culture resources.resjson not found', function (done) {
        this.timeout(1000);

        const tempFolder = path.join(testutil.getTestTemp(), 'loc-fallback-culture-resjson-not-found');
        shell.mkdir('-p', tempFolder);
        const jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
        const jsonPath = path.join(tempFolder, 'task.json');
        fs.writeFileSync(jsonPath, jsonStr);

        process.env['SYSTEM_CULTURE'] = 'zh-CN';

        tl.setResourcePath(jsonPath);
        assert.equal(tl.loc('key2', 2), 'string for key 2.', 'en-US fallback string not return for key.');

        done();
    })
    it('fallback to current string if loc string not found in culture resources.resjson', function (done) {
        this.timeout(1000);

        const tempFolder = path.join(testutil.getTestTemp(), 'loc-fallback-culture-string-not-found');
        shell.mkdir('-p', tempFolder);
        const jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
        const jsonPath = path.join(tempFolder, 'task.json');
        fs.writeFileSync(jsonPath, jsonStr);

        const tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'zh-CN');
        shell.mkdir('-p', tempLocFolder);
        const locJsonStr = "{\"loc.messages.key1\" : \"loc cn-string for key 1.\", \"loc.messages.key3\" : \"loc cn-string for key %%.\"}";
        const locJsonPath = path.join(tempLocFolder, 'resources.resjson');
        fs.writeFileSync(locJsonPath, locJsonStr);

        process.env['SYSTEM_CULTURE'] = 'zh-CN';

        tl.setResourcePath(jsonPath);
        assert.equal(tl.loc('key2', 2), 'string for key 2.', 'en-US fallback string not return for key.');

        done();
    })
    it('fallback to en-US if culture not set', function (done) {
        this.timeout(1000);

        const tempFolder = path.join(testutil.getTestTemp(), 'loc-default-to-en-US');
        shell.mkdir('-p', tempFolder);
        const jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
        const jsonPath = path.join(tempFolder, 'task.json');
        fs.writeFileSync(jsonPath, jsonStr);

        const tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'en-US');
        shell.mkdir('-p', tempLocFolder);
        const locJsonStr = "{\"loc.messages.key1\" : \"loc en-string for key 1.\", \"loc.messages.key2\" : \"loc en-string for key %d.\", \"loc.messages.key3\" : \"loc en-string for key %%.\"}";
        const locJsonPath = path.join(tempLocFolder, 'resources.resjson');
        fs.writeFileSync(locJsonPath, locJsonStr);

        process.env['SYSTEM_CULTURE'] = '';

        tl.setResourcePath(jsonPath);
        assert.equal(tl.loc('key2', 2), 'loc en-string for key 2.', 'en-US fallback string not return for key.');

        done();
    })
    it('return key and params if key is not in task.json', function (done) {
        this.timeout(1000);

        const tempFolder = path.join(testutil.getTestTemp(), 'loc-key-not-found-returns-key-plus-args');
        shell.mkdir('-p', tempFolder);
        const jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\"}}";
        const jsonPath = path.join(tempFolder + 'task.json');
        fs.writeFileSync(jsonPath, jsonStr);

        tl.setResourcePath(jsonPath);
        assert.equal(tl.loc('key3', 3), 'key3 3', 'key and params not return for non-exist key.');

        done();
    })
});
