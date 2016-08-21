// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import child = require('child_process');
import path = require('path');
import fs = require('fs');
import util = require('util');
import stream = require('stream');
import shell = require('shelljs');
import os = require('os');

import * as tl from '../_build/task';
import * as vm from '../_build/vault';
import * as tcm from '../_build/taskcommand';
import * as trm from '../_build/toolrunner';

var _testTemp = path.join(__dirname, '_temp');

var plat = os.platform();

var NullStream = function () {
    stream.Writable.call(this);
    this._write = function (data, encoding, next) {
        next();
    }
}
util.inherits(NullStream, stream.Writable);

var StringStream = function () {
    var contents = '';

    stream.Writable.call(this);
    this._write = function (data, encoding, next) {
        contents += data;
        next();
    }

    this.getContents = function () {
        return contents.toString();
    }
}
util.inherits(StringStream, stream.Writable);

var _nullTestStream = new NullStream();

var _buildOutput = function (lines) {
    var output = '';
    lines.forEach(function (line) {
        output += line + os.EOL;
    });

    return output;
}

/**
 * Creates a symlink directory on OSX/Linux, and a junction point directory on Windows.
 * A symlink directory is not created on Windows since it requires an elevated context.
 */
let createSymlinkDir = (real: string, link: string): void => {
    if (plat == 'win32') {
        let result = child.spawnSync('cmd.exe', [ '/c', 'mklink', '/J', link, real ]);
        if (result.status != 0) {
            let message: string = (result.output || []).join(' ').trim();
            throw new Error(`Failed to create junction point '${link}' for directory '${real}'. ${message}`);
        }
    }
    else {
        fs.symlinkSync(real, link);
    }
};

describe('Test vsts-task-lib', function () {

    before(function (done) {
        try {
            tl.setStdStream(_nullTestStream);
            tl.setErrStream(_nullTestStream);
            tl.setEnvVar('TASKLIB_INPROC_UNITS', '1');

            tl.mkdirP(_testTemp);
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });

    describe('node', () => {
        it('is expected version', (done: MochaDone) => {
            this.timeout(1000);

            assert.equal(process.version, 'v5.10.1');

            done();
        });
    });

    describe('Dir Operations', function () {
        // find tests
        it('returns hidden files with find', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   find_hidden_files
            //   find_hidden_files/.emptyFolder
            //   find_hidden_files/.file
            //   find_hidden_files/.folder
            //   find_hidden_files/.folder/file
            let root: string = path.join(_testTemp, 'find_hidden_files');
            shell.mkdir('-p', path.join(root, '.emptyFolder'));
            shell.mkdir('-p', path.join(root, '.folder'));
            fs.writeFileSync(path.join(root, '.file'), 'test .file content');
            fs.writeFileSync(path.join(root, '.folder', 'file'), 'test .folder/file content');

            let itemPaths: string[] = tl.find(root);
            assert.equal(5, itemPaths.length);
            assert.equal(itemPaths[0], root);
            assert.equal(itemPaths[1], path.join(root, '.emptyFolder'));
            assert.equal(itemPaths[2], path.join(root, '.file'));
            assert.equal(itemPaths[3], path.join(root, '.folder'));
            assert.equal(itemPaths[4], path.join(root, '.folder', 'file'));

            done();
        });

        it('returns depth first find', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   find_depth_first/a_file
            //   find_depth_first/b_folder
            //   find_depth_first/b_folder/a_file
            //   find_depth_first/b_folder/b_folder
            //   find_depth_first/b_folder/b_folder/file
            //   find_depth_first/b_folder/c_file
            //   find_depth_first/c_file
            let root: string = path.join(_testTemp, 'find_depth_first');
            shell.mkdir('-p', path.join(root, 'b_folder', 'b_folder'));
            fs.writeFileSync(path.join(root, 'a_file'), 'test a_file content');
            fs.writeFileSync(path.join(root, 'b_folder', 'a_file'), 'test b_folder/a_file content');
            fs.writeFileSync(path.join(root, 'b_folder', 'b_folder', 'file'), 'test b_folder/b_folder/file content');
            fs.writeFileSync(path.join(root, 'b_folder', 'c_file'), 'test b_folder/c_file content');
            fs.writeFileSync(path.join(root, 'c_file'), 'test c_file content');

            let itemPaths: string[] = tl.find(root);
            assert.equal(8, itemPaths.length);
            assert.equal(itemPaths[0], root);
            assert.equal(itemPaths[1], path.join(root, 'a_file'));
            assert.equal(itemPaths[2], path.join(root, 'b_folder'));
            assert.equal(itemPaths[3], path.join(root, 'b_folder', 'a_file'));
            assert.equal(itemPaths[4], path.join(root, 'b_folder', 'b_folder'));
            assert.equal(itemPaths[5], path.join(root, 'b_folder', 'b_folder', 'file'));
            assert.equal(itemPaths[6], path.join(root, 'b_folder', 'c_file'));
            assert.equal(itemPaths[7], path.join(root, 'c_file'));

            done();
        });

        it('returns empty when not exists', (done: MochaDone) => {
            this.timeout(1000);

            let itemPaths: string[] = tl.find(path.join(_testTemp, 'nosuch'));
            assert.equal(0, itemPaths.length);

            done();
        });

        it('does not follow specified symlink', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   realDir
            //   realDir/file
            //   symDir -> realDir
            let root: string = path.join(_testTemp, 'find_no_follow_specified_symlink');
            shell.mkdir('-p', path.join(root, 'realDir'));
            fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
            createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

            let itemPaths: string[] = tl.find(path.join(root, 'symDir'));
            assert.equal(itemPaths.length, 1);
            assert.equal(itemPaths[0], path.join(root, 'symDir'));

            done();
        });

        it('follows specified symlink when -H', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   realDir
            //   realDir/file
            //   symDir -> realDir
            let root: string = path.join(_testTemp, 'find_follow_specified_symlink_when_-H');
            shell.mkdir('-p', path.join(root, 'realDir'));
            fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
            createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

            let options: tl.FindOptions = {} as tl.FindOptions;
            options.followSpecifiedSymbolicLink = true; // equivalent to "find -H"
            let itemPaths: string[] = tl.find(path.join(root, 'symDir'), options);
            assert.equal(itemPaths.length, 2);
            assert.equal(itemPaths[0], path.join(root, 'symDir'));
            assert.equal(itemPaths[1], path.join(root, 'symDir', 'file'));

            done();
        });

        it('follows specified symlink when -L', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   realDir
            //   realDir/file
            //   symDir -> realDir
            let root: string = path.join(_testTemp, 'find_follow_specified_symlink_when_-L');
            shell.mkdir('-p', path.join(root, 'realDir'));
            fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
            createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

            let options: tl.FindOptions = {} as tl.FindOptions;
            options.followSymbolicLinks = true; // equivalent to "find -L"
            let itemPaths: string[] = tl.find(path.join(root, 'symDir'), options);
            assert.equal(itemPaths.length, 2);
            assert.equal(itemPaths[0], path.join(root, 'symDir'));
            assert.equal(itemPaths[1], path.join(root, 'symDir', 'file'));

            done();
        });

        it('does not follow symlink', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   <root>
            //   <root>/realDir
            //   <root>/realDir/file
            //   <root>/symDir -> <root>/realDir
            let root: string = path.join(_testTemp, 'find_no_follow_symlink');
            shell.mkdir('-p', path.join(root, 'realDir'));
            fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
            createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

            let itemPaths: string[] = tl.find(root);
            assert.equal(itemPaths.length, 4);
            assert.equal(itemPaths[0], root);
            assert.equal(itemPaths[1], path.join(root, 'realDir'));
            assert.equal(itemPaths[2], path.join(root, 'realDir', 'file'));
            assert.equal(itemPaths[3], path.join(root, 'symDir'));

            done();
        });

        it('does not follow symlink when -H', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   <root>
            //   <root>/realDir
            //   <root>/realDir/file
            //   <root>/symDir -> <root>/realDir
            let root: string = path.join(_testTemp, 'find_no_follow_symlink_when_-H');
            shell.mkdir('-p', path.join(root, 'realDir'));
            fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
            createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

            let options: tl.FindOptions = {} as tl.FindOptions;
            options.followSpecifiedSymbolicLink = true;
            let itemPaths: string[] = tl.find(root, options);
            assert.equal(itemPaths.length, 4);
            assert.equal(itemPaths[0], root);
            assert.equal(itemPaths[1], path.join(root, 'realDir'));
            assert.equal(itemPaths[2], path.join(root, 'realDir', 'file'));
            assert.equal(itemPaths[3], path.join(root, 'symDir'));

            done();
        });

        it('follows symlink when -L', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   <root>
            //   <root>/realDir
            //   <root>/realDir/file
            //   <root>/symDir -> <root>/realDir
            let root: string = path.join(_testTemp, 'find_follow_symlink_when_-L');
            shell.mkdir('-p', path.join(root, 'realDir'));
            fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
            createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

            let options: tl.FindOptions = {} as tl.FindOptions;
            options.followSymbolicLinks = true;
            let itemPaths: string[] = tl.find(root, options);
            assert.equal(itemPaths.length, 5);
            assert.equal(itemPaths[0], root);
            assert.equal(itemPaths[1], path.join(root, 'realDir'));
            assert.equal(itemPaths[2], path.join(root, 'realDir', 'file'));
            assert.equal(itemPaths[3], path.join(root, 'symDir'));
            assert.equal(itemPaths[4], path.join(root, 'symDir', 'file'));

            done();
        });

        it('detects cycle', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   <root>
            //   <root>/file
            //   <root>/symDir -> <root>
            let root: string = path.join(_testTemp, 'find_detects_cycle');
            shell.mkdir('-p', root);
            fs.writeFileSync(path.join(root, 'file'), 'test file content');
            createSymlinkDir(root, path.join(root, 'symDir'));

            let itemPaths: string[] = tl.find(root, { followSymbolicLinks: true } as tl.FindOptions);
            assert.equal(itemPaths.length, 3);
            assert.equal(itemPaths[0], root);
            assert.equal(itemPaths[1], path.join(root, 'file'));
            assert.equal(itemPaths[2], path.join(root, 'symDir'));

            done();
        });

        it('detects cycle starting from symlink', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   <root>
            //   <root>/file
            //   <root>/symDir -> <root>
            let root: string = path.join(_testTemp, 'find_detects_cycle_starting_from_symlink');
            shell.mkdir('-p', root);
            fs.writeFileSync(path.join(root, 'file'), 'test file content');
            createSymlinkDir(root, path.join(root, 'symDir'));

            let itemPaths: string[] = tl.find(path.join(root, 'symDir'), { followSymbolicLinks: true } as tl.FindOptions);
            assert.equal(itemPaths.length, 3);
            assert.equal(itemPaths[0], path.join(root, 'symDir'));
            assert.equal(itemPaths[1], path.join(root, 'symDir', 'file'));
            assert.equal(itemPaths[2], path.join(root, 'symDir', 'symDir'));

            done();
        });

        it('detects deep cycle starting from middle', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   <root>
            //   <root>/file_under_root
            //   <root>/folder_a
            //   <root>/folder_a/file_under_a
            //   <root>/folder_a/folder_b
            //   <root>/folder_a/folder_b/file_under_b
            //   <root>/folder_a/folder_b/folder_c
            //   <root>/folder_a/folder_b/folder_c/file_under_c
            //   <root>/folder_a/folder_b/folder_c/sym_folder -> <root>
            let root: string = path.join(_testTemp, 'find_detects_deep_cycle_starting_from_middle');
            shell.mkdir('-p', path.join(root, 'folder_a', 'folder_b', 'folder_c'));
            fs.writeFileSync(path.join(root, 'file_under_root'), 'test file under root contents');
            fs.writeFileSync(path.join(root, 'folder_a', 'file_under_a'), 'test file under a contents');
            fs.writeFileSync(path.join(root, 'folder_a', 'folder_b', 'file_under_b'), 'test file under b contents');
            fs.writeFileSync(path.join(root, 'folder_a', 'folder_b', 'folder_c', 'file_under_c'), 'test file under c contents');
            createSymlinkDir(root, path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder'));

            let itemPaths: string[] = tl.find(path.join(root, 'folder_a', 'folder_b'), { followSymbolicLinks: true } as tl.FindOptions);
            assert.equal(itemPaths.length, 9);
            assert.equal(itemPaths[0], path.join(root, 'folder_a', 'folder_b'));
            assert.equal(itemPaths[1], path.join(root, 'folder_a', 'folder_b', 'file_under_b'));
            assert.equal(itemPaths[2], path.join(root, 'folder_a', 'folder_b', 'folder_c'));
            assert.equal(itemPaths[3], path.join(root, 'folder_a', 'folder_b', 'folder_c', 'file_under_c'));
            assert.equal(itemPaths[4], path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder'));
            assert.equal(itemPaths[5], path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder', 'file_under_root'));
            assert.equal(itemPaths[6], path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder', 'folder_a'));
            assert.equal(itemPaths[7], path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder', 'folder_a', 'file_under_a'));
            assert.equal(itemPaths[8], path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder', 'folder_a', 'folder_b'));

            done();
        });

        // mkdirP tests
        it('creates folder with mkdirP', function (done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'mkdirTest');
            tl.mkdirP(testPath);
            assert(shell.test('-d', testPath), 'directory created');

            done();
        });

        it('creates nested folders with mkdirP', function (done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'mkdir1', 'mkdir2');
            tl.mkdirP(testPath);
            assert(shell.test('-d', testPath), 'directory created');

            done();
        });

        it('fails if mkdirP with illegal chars', function (done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'mkdir\0');
            var worked: boolean = false;
            try {
                tl.mkdirP(testPath);
                worked = true;
            }
            catch (err) {
                // asserting failure
                assert(!shell.test('-d', testPath), 'directory should not be created');
            }

            assert(!worked, 'mkdirP with illegal chars should have not have worked');

            done();
        });

        it('fails if mkdirP with null path', function (done) {
            this.timeout(1000);

            var worked: boolean = false;
            try {
                tl.mkdirP(null);
                worked = true;
            }
            catch (err) { }

            assert(!worked, 'mkdirP with null should have not have worked');

            done();
        });

        it('fails if mkdirP with empty path', function (done) {
            this.timeout(1000);

            var worked: boolean = false;
            try {
                tl.mkdirP('');
                worked = true;
            }
            catch (err) { }

            assert(!worked, 'mkdirP with empty string should have not have worked');

            done();
        });

        it('fails if mkdirP with conflicting file path', (done: MochaDone) => {
            this.timeout(1000);

            let testPath = path.join(_testTemp, 'mkdirP_conflicting_file_path');
            shell.mkdir('-p', _testTemp);
            fs.writeFileSync(testPath, '');
            let worked: boolean = false;
            try {
                tl.mkdirP(testPath);
                worked = true;
            }
            catch (err) { }

            assert(!worked, 'mkdirP with conflicting file path should not have worked');

            done();
        });

        it('fails if mkdirP with conflicting parent file path', (done: MochaDone) => {
            this.timeout(1000);

            let testPath = path.join(_testTemp, 'mkdirP_conflicting_parent_file_path', 'dir');
            shell.mkdir('-p', _testTemp);
            fs.writeFileSync(path.dirname(testPath), '');
            let worked: boolean = false;
            try {
                tl.mkdirP(testPath);
                worked = true;
            }
            catch (err) { }

            assert(!worked, 'mkdirP with conflicting file path should not have worked');

            done();
        });

        it('no-ops if mkdirP directory exists', (done: MochaDone) => {
            this.timeout(1000);

            let testPath = path.join(_testTemp, 'mkdirP_dir_exists');
            shell.mkdir('-p', _testTemp);
            fs.mkdirSync(testPath);

            tl.mkdirP(testPath); // should not throw

            done();
        });

        it('no-ops if mkdirP with symlink directory', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   real_dir
            //   real_dir/file.txt
            //   symlink_dir -> real_dir
            let rootPath = path.join(_testTemp, 'mkdirP_symlink_dir');
            let realDirPath = path.join(rootPath, 'real_dir');
            let realFilePath = path.join(realDirPath, 'file.txt');
            let symlinkDirPath = path.join(rootPath, 'symlink_dir');
            shell.mkdir('-p', _testTemp);
            fs.mkdirSync(rootPath);
            fs.mkdirSync(realDirPath);
            fs.writeFileSync(realFilePath, 'test real_dir/file.txt contet');
            createSymlinkDir(realDirPath, symlinkDirPath);

            tl.mkdirP(symlinkDirPath);

            // the file in the real directory should still be accessible via the symlink
            assert.equal(fs.lstatSync(symlinkDirPath).isSymbolicLink(), true);
            assert.equal(fs.statSync(path.join(symlinkDirPath, 'file.txt')).isFile(), true);

            done();
        });

        it('no-ops if mkdirP with parent symlink directory', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   real_dir
            //   real_dir/file.txt
            //   symlink_dir -> real_dir
            let rootPath = path.join(_testTemp, 'mkdirP_parent_symlink_dir');
            let realDirPath = path.join(rootPath, 'real_dir');
            let realFilePath = path.join(realDirPath, 'file.txt');
            let symlinkDirPath = path.join(rootPath, 'symlink_dir');
            shell.mkdir('-p', _testTemp);
            fs.mkdirSync(rootPath);
            fs.mkdirSync(realDirPath);
            fs.writeFileSync(realFilePath, 'test real_dir/file.txt contet');
            createSymlinkDir(realDirPath, symlinkDirPath);

            let subDirPath = path.join(symlinkDirPath, 'sub_dir');
            tl.mkdirP(subDirPath);

            // the subdirectory should be accessible via the real directory
            assert.equal(fs.lstatSync(path.join(realDirPath, 'sub_dir')).isDirectory(), true);

            done();
        });

        it('breaks if mkdirP loop out of control', (done: MochaDone) => {
            this.timeout(1000);

            process.env['TASKLIB_TEST_MKDIRP_FAILSAFE'] = '10';
            let testPath = path.join(_testTemp, 'mkdirP_failsafe', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10');

            try {
                tl.mkdirP(testPath);
                throw new Error("directory should not have been created");
            }
            catch (err) {
                // ENOENT is expected, all other errors are not
                if (err.code != 'ENOENT') {
                    throw err;
                }
            }

            done();
        });

        // rmRF tests
        it('removes single folder with rmRF', function (done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'testFolder');

            tl.mkdirP(testPath);
            assert(shell.test('-d', testPath), 'directory created');
            assert(shell.test('-e', testPath), 'directory exists');

            tl.rmRF(testPath);
            assert(!shell.test('-e', testPath), 'directory removed');

            done();
        });

        it('removes recursive folders with rmRF', function (done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'testDir1');
            var testPath2 = path.join(testPath, 'testDir2');
            tl.mkdirP(testPath2);

            assert(shell.test('-d', testPath), '1 directory created');
            assert(shell.test('-d', testPath2), '2 directory created');

            tl.rmRF(testPath);
            assert(!shell.test('-e', testPath), '1 directory removed');
            assert(!shell.test('-e', testPath2), '2 directory removed');

            done();
        });

        it('removes folder with locked file with rmRF', function (done) {
            this.timeout(1000);

            var testPath = path.join(_testTemp, 'testFolder');
            tl.mkdirP(testPath);
            assert(shell.test('-d', testPath), 'directory created');

            // can't remove folder with locked file on windows
            var filePath = path.join(testPath, 'file.txt');
            fs.appendFileSync(filePath, 'some data');
            assert(shell.test('-e', filePath), 'file exists');

            var fd = fs.openSync(filePath, 'r');

            var worked = false;
            try {
                tl.rmRF(testPath);
                worked = true;
            }
            catch (err) { }

            if (plat === 'win32') {
                assert(!worked, 'should not work on windows');
                assert(shell.test('-e', testPath), 'directory still exists');
            }
            else {
                assert(worked, 'should work on nix');
                assert(!shell.test('-e', testPath), 'directory removed');
            }

            fs.closeSync(fd);
            tl.rmRF(testPath);
            assert(!shell.test('-e', testPath), 'directory removed');

            done();
        });

        it('removes folder that doesnt exist with rmRF', function (done) {
            this.timeout(1000);

            var testFolder = 'testDir';
            var start = __dirname;
            var testPath = path.join(__dirname, testFolder);
            tl.cd(start);
            assert(process.cwd() == start, 'starting in right directory');

            assert(!shell.test('-d', testPath), 'directory created');
            assert(!shell.test('-e', testPath), 'directory exists');

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            tl.rmRF(testPath);
            assert(!shell.test('-e', testPath), 'directory still doesnt exist');

            done();
        });

        it('removes file with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            let file: string = path.join(_testTemp, 'rmRF_file');
            fs.writeFileSync(file, 'test file content');
            assert(shell.test('-f', file), 'file should have been created');
            tl.rmRF(file);
            assert(!shell.test('-e', file), 'file should not exist');

            done();
        });

        it('removes hidden folder with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            let directory: string = path.join(_testTemp, '.rmRF_directory');
            tl.mkdirP(directory);
            assert(shell.test('-d', directory), 'directory should have been created');
            tl.rmRF(directory);
            assert(!shell.test('-e', directory), 'directory should not exist');

            done();
        });

        it('removes hidden file with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            let file: string = path.join(_testTemp, '.rmRF_file');
            fs.writeFileSync(file, 'test file content');
            assert(shell.test('-f', file), 'file should have been created');
            tl.rmRF(file);
            assert(!shell.test('-e', file), 'file should not exist');

            done();
        });

        it('removes symlink folder with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   real_directory
            //   real_directory/real_file
            //   symlink_directory -> real_directory
            let root: string = path.join(_testTemp, 'rmRF_sym_dir_test');
            let realDirectory: string = path.join(root, 'real_directory');
            let realFile: string = path.join(root, 'real_directory', 'real_file');
            let symlinkDirectory: string = path.join(root, 'symlink_directory');
            tl.mkdirP(realDirectory);
            fs.writeFileSync(realFile, 'test file content');
            createSymlinkDir(realDirectory, symlinkDirectory);
            assert(shell.test('-f', path.join(symlinkDirectory, 'real_file')), 'symlink directory should be created correctly');

            tl.rmRF(symlinkDirectory);
            assert(shell.test('-d', realDirectory), 'real directory should still exist');
            assert(shell.test('-f', realFile), 'file should still exist');
            assert(!shell.test('-e', symlinkDirectory), 'symlink directory should have been deleted');

            done();
        });

        // creating a symlink on Windows requires elevated
        if (plat != 'win32') {
            it('removes symlink file with rmRF', (done: MochaDone) => {
                this.timeout(1000);

                // create the following layout:
                //   real_file
                //   symlink_file -> real_file
                let root: string = path.join(_testTemp, 'rmRF_sym_file_test');
                let realFile: string = path.join(root, 'real_file');
                let symlinkFile: string = path.join(root, 'symlink_file');
                tl.mkdirP(root);
                fs.writeFileSync(realFile, 'test file content');
                fs.symlinkSync(realFile, symlinkFile);
                assert.equal(fs.readFileSync(symlinkFile), 'test file content');

                tl.rmRF(symlinkFile);
                assert(shell.test('-f', realFile), 'real file should still exist');
                assert(!shell.test('-e', symlinkFile), 'symlink file should have been deleted');

                done();
            });

            it('removes symlink file with missing source using rmRF', (done: MochaDone) => {
                this.timeout(1000);

                // create the following layout:
                //   real_file
                //   symlink_file -> real_file
                let root: string = path.join(_testTemp, 'rmRF_sym_file_missing_source_test');
                let realFile: string = path.join(root, 'real_file');
                let symlinkFile: string = path.join(root, 'symlink_file');
                tl.mkdirP(root);
                fs.writeFileSync(realFile, 'test file content');
                fs.symlinkSync(realFile, symlinkFile);
                assert.equal(fs.readFileSync(symlinkFile), 'test file content');

                // remove the real file
                fs.unlink(realFile);
                assert(fs.statSync(symlinkFile).isFile(), 'symlink file should still exist');

                // remove the symlink file
                tl.rmRF(symlinkFile);
                let errcode: string;
                try {
                    fs.statSync(symlinkFile);
                }
                catch (err) {
                    errcode = err.code;
                }

                assert.equal(errcode, 'ENOENT');

                done();
            });

            it('removes symlink level 2 file with rmRF', (done: MochaDone) => {
                this.timeout(1000);

                // create the following layout:
                //   real_file
                //   symlink_file -> real_file
                //   symlink_level_2_file -> symlink_file
                let root: string = path.join(_testTemp, 'rmRF_sym_level_2_file_test');
                let realFile: string = path.join(root, 'real_file');
                let symlinkFile: string = path.join(root, 'symlink_file');
                let symlinkLevel2File: string = path.join(root, 'symlink_level_2_file');
                tl.mkdirP(root);
                fs.writeFileSync(realFile, 'test file content');
                fs.symlinkSync(realFile, symlinkFile);
                fs.symlinkSync(symlinkFile, symlinkLevel2File);
                assert.equal(fs.readFileSync(symlinkLevel2File), 'test file content');

                tl.rmRF(symlinkLevel2File);
                assert(shell.test('-f', realFile), 'real file should still exist');
                assert(shell.test('-e', symlinkFile), 'symlink file should still exist');
                assert(!shell.test('-e', symlinkLevel2File), 'symlink level 2 file should have been deleted');

                done();
            });
        }

        it('removes symlink level 2 folder with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   real_directory
            //   real_directory/real_file
            //   symlink_directory -> real_directory
            //   symlink_level_2_directory -> symlink_directory
            let root: string = path.join(_testTemp, 'rmRF_sym_level_2_directory_test');
            let realDirectory: string = path.join(root, 'real_directory');
            let realFile: string = path.join(realDirectory, 'real_file');
            let symlinkDirectory: string = path.join(root, 'symlink_directory');
            let symlinkLevel2Directory: string = path.join(root, 'symlink_level_2_directory');
            tl.mkdirP(realDirectory);
            fs.writeFileSync(realFile, 'test file content');
            createSymlinkDir(realDirectory, symlinkDirectory);
            createSymlinkDir(symlinkDirectory, symlinkLevel2Directory);
            assert.equal(fs.readFileSync(path.join(symlinkDirectory, 'real_file')), 'test file content');

            tl.rmRF(symlinkLevel2Directory);
            assert(shell.test('-f', path.join(symlinkDirectory, 'real_file')), 'real file should still exist');
            assert(!shell.test('-e', symlinkLevel2Directory), 'symlink level 2 file should have been deleted');

            done();
        });

        it('removes hidden file with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            let file: string = path.join(_testTemp, '.rmRF_file');
            fs.writeFileSync(file, 'test file content');
            assert(shell.test('-f', file), 'file should have been created');
            tl.rmRF(file);
            assert(!shell.test('-e', file), 'file should not exist');

            done();
        });

        // mv tests
        it('move to non existant destination', function (done) {
            this.timeout(1000);

            var sourceFile = 'sourceFile';
            var destFile = 'destFile';
            var start = __dirname;
            var testPath = path.join(__dirname, sourceFile);
            var destPath = path.join(__dirname, destFile);
            tl.cd(start);
            assert(process.cwd() == start, 'did not start in right directory');

            shell.rm('-f', sourceFile);
            shell.rm('-f', destFile);

            assert(!shell.test('-e', destFile), 'destination file exists');

            fs.writeFileSync(sourceFile, "test move");
            assert(shell.test('-e', sourceFile), 'source file does not exist');

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            tl.mv(sourceFile, destFile);
            assert(!shell.test('-e', sourceFile), 'source file still exist');
            assert(shell.test('-e', destFile), 'dest file still does not exist');

            done();
        });

        it('move to existing destination should fail unless forced', function (done) {
            this.timeout(1000);

            var sourceFile = 'sourceFile';
            var destFile = 'destFile';
            var start = __dirname;
            var testPath = path.join(__dirname, sourceFile);
            var destPath = path.join(__dirname, destFile);
            tl.cd(start);
            assert(process.cwd() == start, 'did not start in right directory');

            shell.rm('-f', sourceFile);
            shell.rm('-f', destFile);

            fs.writeFileSync(sourceFile, "test move");
            fs.writeFileSync(destFile, "test move destination");

            assert(shell.test('-e', sourceFile), 'source file does not exist');
            assert(shell.test('-e', destFile), 'destination does not file exists');

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var worked: boolean = false;
            try {
                tl.mv(sourceFile, destFile);
                worked = true;
            }
            catch (err) {
                // this should fail
                assert(shell.test('-e', sourceFile), 'source file does not exist');
                assert(shell.test('-e', destFile), 'dest file does not exist');
            }

            assert(!worked, 'mv should have not have worked');

            tl.mv(sourceFile, destFile, '-f');
            assert(!shell.test('-e', sourceFile), 'source file should not exist');
            assert(shell.test('-e', destFile), 'dest file does not exist after mv -f');

            done();
        });
    });

    describe('Which on Windows', function () {
        it('which() on windows return file with Extension', function (done) {
            this.timeout(1000);

            if (os.type().match(/^Win/)) {
                var testPath = path.join(_testTemp, 'whichTest');
                tl.mkdirP(testPath);

                fs.writeFileSync(path.join(testPath, 'whichTest'), 'contents');
                fs.writeFileSync(path.join(testPath, 'whichTest.exe'), 'contents');

                if (process.env.path) {
                    process.env.path = process.env.path + ';' + testPath;
                }
                else if (process.env.Path) {
                    process.env.Path = process.env.Path + ';' + testPath;
                }
                else if (process.env.PATH) {
                    process.env.PATH = process.env.PATH + ';' + testPath;
                }

                var whichResult = tl.which('whichTest');
                assert(whichResult.indexOf('.exe') > 0, 'Which() should return file with extension on windows.');
            }
            done();
        });
    });

    describe('TaskInputsVariables', function () {
        // getInput tests
        it('gets input value', function (done) {
            this.timeout(1000);

            process.env['INPUT_UNITTESTINPUT'] = 'test value';
            tl._loadData();

            var inval = tl.getInput('UnitTestInput', true);
            assert.equal(inval, 'test value');

            done();
        })
        it('should clear input envvar', function (done) {
            this.timeout(1000);

            process.env['INPUT_UNITTESTINPUT'] = 'test value';
            tl._loadData();
            var inval = tl.getInput('UnitTestInput', true);
            assert.equal(inval, 'test value');
            assert(!process.env['INPUT_UNITTESTINPUT'], 'input envvar should be cleared');

            done();
        })
        it('required input throws', function (done) {
            this.timeout(1000);

            var worked: boolean = false;
            try {
                var inval = tl.getInput('SomeUnsuppliedRequiredInput', true);
                worked = true;
            }
            catch (err) { }

            assert(!worked, 'req input should have not have worked');

            done();
        })
        it('gets input value with whitespace', function (done) {
            this.timeout(1000);

            process.env['INPUT_UNITTESTINPUT'] = '   test value   ';
            tl._loadData();

            var inval = tl.getInput('UnitTestInput', true);
            assert.equal(inval, 'test value');

            done();
        })

        // getVariable tests
        it('gets a variable', function (done) {
            this.timeout(1000);

            process.env['BUILD_REPOSITORY_NAME'] = 'Test Repository';
            tl._loadData();

            var varVal = tl.getVariable('Build.Repository.Name');
            assert.equal(varVal, 'Test Repository');

            done();
        })
        it('gets a secret variable', function (done) {
            this.timeout(1000);

            process.env['SECRET_BUILD_REPOSITORY_NAME'] = 'Test Repository';
            tl._loadData();

            var varVal = tl.getVariable('Build.Repository.Name');
            assert.equal(varVal, 'Test Repository');

            done();
        })
        it('gets a secret variable while variable also exist', function (done) {
            this.timeout(1000);

            process.env['BUILD_REPOSITORY_NAME'] = 'Test Repository';
            process.env['SECRET_BUILD_REPOSITORY_NAME'] = 'Secret Test Repository';
            tl._loadData();

            var varVal = tl.getVariable('Build.Repository.Name');
            assert.equal(varVal, 'Secret Test Repository');

            done();
        })

        // setVariable tests
        it('sets a variable as an env var', function (done) {
            this.timeout(1000);

            tl.setVariable('Build.Repository.Uri', 'test value');
            let varVal: string = process.env['BUILD_REPOSITORY_URI'];
            assert.equal(varVal, 'test value');

            done();
        })
        it('sets and gets a variable', function (done) {
            this.timeout(1000);

            tl.setVariable('UnitTestVariable', 'test var value');
            let varVal: string = tl.getVariable('UnitTestVariable');
            assert.equal(varVal, 'test var value');

            done();
        })
        it('sets and gets a secret variable', function (done) {
            this.timeout(1000);

            tl.setVariable('My.Secret.Var', 'test secret value', true);
            let varVal: string = tl.getVariable('My.Secret.Var');
            assert.equal(varVal, 'test secret value');

            done();
        })
        it('does not set a secret variable as an env var', function (done) {
            this.timeout(1000);

            delete process.env['MY_SECRET_VAR'];
            tl.setVariable('My.Secret.Var', 'test secret value', true);
            let envVal: string = process.env['MY_SECRET_VAR'];
            assert(!envVal, 'env var should not be set');

            done();
        })
        it('removes env var when sets a secret variable', function (done) {
            this.timeout(1000);

            process.env['MY_SECRET_VAR'] = 'test env value';
            tl.setVariable('My.Secret.Var', 'test secret value', true);
            let envVal: string = process.env['MY_SECRET_VAR'];
            assert(!envVal, 'env var should not be set');

            done();
        })
        it('does not allow a secret variable to become a public variable', function (done) {
            this.timeout(1000);

            tl._loadData();
            tl.setVariable('My.Secret.Var', 'test secret value', true);
            tl.setVariable('My.Secret.Var', 'test modified value', false);
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert.equal(vars.length, 1);
            assert.equal(vars[0].name, 'My.Secret.Var');
            assert.equal(vars[0].value, 'test modified value');
            assert.equal(vars[0].secret, true);

            done();
        })
        it('allows a public variable to become a secret variable', function (done) {
            this.timeout(1000);

            tl._loadData();
            tl.setVariable('My.Var', 'test value', false);
            tl.setVariable('My.Var', 'test modified value', true);
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert.equal(vars.length, 1);
            assert.equal(vars[0].name, 'My.Var');
            assert.equal(vars[0].value, 'test modified value');
            assert.equal(vars[0].secret, true);

            done();
        })
        it('tracks known variables using env formatted name', function (done) {
            this.timeout(1000);

            tl._loadData();
            tl.setVariable('My.Public.Var', 'test value');
            tl.setVariable('my_public.VAR', 'test modified value');
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert.equal(vars.length, 1);
            assert.equal(vars[0].name, 'my_public.VAR');
            assert.equal(vars[0].value, 'test modified value');

            done();
        })

        // getVariables tests
        it('gets public variables from initial load', function (done) {
            this.timeout(1000);

            process.env['PUBLIC_VAR_ONE'] = 'public value 1';
            process.env['PUBLIC_VAR_TWO'] = 'public value 2';
            process.env['VSTS_PUBLIC_VARIABLES'] = '[ "Public.Var.One", "Public.Var.Two" ]';
            tl._loadData();
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert(vars, 'variables should not be undefined or null');
            assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
            vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
            assert.equal(vars[0].name, 'Public.Var.One');
            assert.equal(vars[0].value, 'public value 1');
            assert.equal(vars[0].secret, false);
            assert.equal(vars[1].name, 'Public.Var.Two');
            assert.equal(vars[1].value, 'public value 2');
            assert.equal(vars[1].secret, false);

            done();
        })
        it('gets secret variables from initial load', function (done) {
            this.timeout(1000);

            process.env['SECRET_SECRET_VAR_ONE'] = 'secret value 1';
            process.env['SECRET_SECRET_VAR_TWO'] = 'secret value 2';
            process.env['VSTS_SECRET_VARIABLES'] = '[ "Secret.Var.One", "Secret.Var.Two" ]';
            tl._loadData();
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert(vars, 'variables should not be undefined or null');
            assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
            vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
            assert.equal(vars[0].name, 'Secret.Var.One');
            assert.equal(vars[0].value, 'secret value 1');
            assert.equal(vars[0].secret, true);
            assert.equal(vars[1].name, 'Secret.Var.Two');
            assert.equal(vars[1].value, 'secret value 2');
            assert.equal(vars[1].secret, true);

            done();
        })
        it('gets secret variables from initial load in pre 2.104.1 agent', function (done) {
            this.timeout(1000);

            process.env['SECRET_SECRET_VAR_ONE'] = 'secret value 1';
            process.env['SECRET_SECRET_VAR_TWO'] = 'secret value 2';
            tl._loadData();
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert(vars, 'variables should not be undefined or null');
            assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
            vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
            assert.equal(vars[0].name, 'SECRET_VAR_ONE');
            assert.equal(vars[0].value, 'secret value 1');
            assert.equal(vars[0].secret, true);
            assert.equal(vars[1].name, 'SECRET_VAR_TWO');
            assert.equal(vars[1].value, 'secret value 2');
            assert.equal(vars[1].secret, true);

            done();
        })
        it('gets public variables from setVariable', function (done) {
            this.timeout(1000);

            process.env['INITIAL_PUBLIC_VAR'] = 'initial public value';
            process.env['VSTS_PUBLIC_VARIABLES'] = '[ "Initial.Public.Var" ]';
            tl._loadData();
            tl.setVariable('Set.Public.Var', 'set public value');
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert(vars, 'variables should not be undefined or null');
            assert.equal(vars.length, 2, 'exactly 4 variables should be returned');
            vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
            assert.equal(vars[0].name, 'Initial.Public.Var');
            assert.equal(vars[0].value, 'initial public value');
            assert.equal(vars[0].secret, false);
            assert.equal(vars[1].name, 'Set.Public.Var');
            assert.equal(vars[1].value, 'set public value');
            assert.equal(vars[1].secret, false);

            done();
        })
        it('gets secret variables from setVariable', function (done) {
            this.timeout(1000);

            process.env['SECRET_INITIAL_SECRET_VAR'] = 'initial secret value';
            process.env['VSTS_SECRET_VARIABLES'] = '[ "Initial.Secret.Var" ]';
            tl._loadData();
            tl.setVariable('Set.Secret.Var', 'set secret value', true);
            let vars: tl.VariableInfo[] = tl.getVariables();
            assert(vars, 'variables should not be undefined or null');
            assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
            vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
            assert.equal(vars[0].name, 'Initial.Secret.Var');
            assert.equal(vars[0].value, 'initial secret value');
            assert.equal(vars[0].secret, true);
            assert.equal(vars[1].name, 'Set.Secret.Var');
            assert.equal(vars[1].value, 'set secret value');
            assert.equal(vars[1].secret, true);

            done();
        })

        // getEndpointUrl/getEndpointAuthorization/getEndpointData tests
        it('gets an endpoint url', function (done) {
            this.timeout(1000);

            process.env['ENDPOINT_URL_id1'] = 'http://url';
            tl._loadData();

            var url = tl.getEndpointUrl('id1', true);
            assert.equal(url, 'http://url', 'url should match');

            done();
        })
        it('gets an endpoint auth', function (done) {
            this.timeout(1000);

            process.env['ENDPOINT_AUTH_id1'] = '{ "parameters": {"param1": "val1", "param2": "val2"}, "scheme": "UsernamePassword"}';
            tl._loadData();

            var auth = tl.getEndpointAuthorization('id1', true);
            assert(auth, 'should return an auth obj');
            assert.equal(auth['parameters']['param1'], 'val1', 'should be correct object');

            done();
        })
        it('gets null if endpoint auth not set', function (done) {
            this.timeout(1000);

            // don't set
            tl._loadData();

            var auth = tl.getEndpointAuthorization('id1', true);
            assert.equal(auth, null, 'should not return an auth obj');

            done();
        })
        it('should clear auth envvar', function (done) {
            this.timeout(1000);

            process.env['ENDPOINT_AUTH_id1'] = '{ "parameters": {"param1": "val1", "param2": "val2"}, "scheme": "UsernamePassword"}';
            tl._loadData();
            var auth = tl.getEndpointAuthorization('id1', true);
            assert(auth, 'should return an auth obj');
            assert(auth['parameters']['param1'] === 'val1', 'should be correct object');
            assert(!process.env['ENDPOINT_AUTH_id1'], 'should clear auth envvar');

            done();
        })
        it('gets endpoint auth scheme', function (done) {
            this.timeout(1000);
            process.env['ENDPOINT_AUTH_SCHEME_id1'] = 'scheme1';
            tl._loadData();

            var data = tl.getEndpointAuthorizationScheme('id1', true);
            assert(data, 'should return a string value');
            assert.equal(data, 'scheme1', 'should be correct scheme');
            assert(!process.env['ENDPOINT_AUTH_SCHEME_id1'], 'should clear auth envvar');

            done();
        })
        it('gets undefined if endpoint auth scheme is not set', function (done) {
            this.timeout(1000);
            tl._loadData();

            var data = tl.getEndpointAuthorizationScheme('id1', true);
            assert(!data, 'should be undefined when auth scheme is not set');

            done();
        })
        it('gets endpoint auth parameters', function (done) {
            this.timeout(1000);
            process.env['ENDPOINT_AUTH_PARAMETER_id1_PARAM1'] = 'value1';
            tl._loadData();

            var data = tl.getEndpointAuthorizationParameter('id1', 'param1', true);
            assert(data, 'should return a string value');
            assert.equal(data, 'value1', 'should be correct auth param');
            assert(!process.env['ENDPOINT_AUTH_PARAMETER_id1_PARAM1'], 'should clear auth envvar');

            done();
        })
        it('gets undefined if endpoint auth parameter is not set', function (done) {
            this.timeout(1000);
            tl._loadData();

            var data = tl.getEndpointAuthorizationParameter('id1', 'noparam', true);
            assert(!data, 'should be undefined when auth param is not set');

            done();
        })
        it('gets an endpoint data', function (done) {
            this.timeout(1000);
            process.env['ENDPOINT_DATA_id1_PARAM1'] = 'val1';
            tl._loadData();

            var data = tl.getEndpointDataParameter('id1', 'param1', true);
            assert(data, 'should return a string value');
            assert.equal(data, 'val1', 'should be correct object');

            done();
        })
        it('gets undefined if endpoint data is not set', function (done) {
            this.timeout(1000);
            tl._loadData();

            var data = tl.getEndpointDataParameter('id1', 'noparam', true);
            assert.equal(data, undefined, 'Error should occur if endpoint data is not set');

            done();
        })

        // getBoolInput tests
        it('gets true bool input value', function (done) {
            this.timeout(1000);

            var inputValue = 'true';
            process.env['INPUT_ABOOL'] = inputValue;
            tl._loadData();

            var outVal = tl.getBoolInput('abool', /*required=*/true);
            assert(outVal, 'should return true');

            done();
        })
        it('gets false bool input value', function (done) {
            this.timeout(1000);

            var inputValue = 'false';
            process.env['INPUT_ABOOL'] = inputValue;
            tl._loadData();

            var outVal = tl.getBoolInput('abool', /*required=*/true);
            assert(!outVal, 'should return false');

            done();
        })

        // getDelimitedInput tests
        it('gets delimited input values removes empty values', function (done) {
            this.timeout(1000);

            var inputValue = 'test  value'; // contains two spaces
            process.env['INPUT_DELIM'] = inputValue;
            tl._loadData();

            var outVal = tl.getDelimitedInput('delim', ' ', /*required*/true);
            assert.equal(outVal.length, 2, 'should return array with two elements');
            assert.equal(outVal[0], 'test', 'should return correct element 1');
            assert.equal(outVal[1], 'value', 'should return correct element 2');

            done();
        })
        it('gets delimited input for a single value', function (done) {
            this.timeout(1000);

            var inputValue = 'testvalue';
            process.env['INPUT_DELIM'] = inputValue;
            tl._loadData();

            var outVal = tl.getDelimitedInput('delim', ' ', /*required*/true);
            assert.equal(outVal.length, 1, 'should return array with one element');
            assert.equal(outVal[0], 'testvalue', 'should return correct element 1');

            done();
        })
        it('gets delimited input for an empty value', function (done) {
            this.timeout(1000);

            var inputValue = '';
            process.env['INPUT_DELIM'] = inputValue;
            tl._loadData();

            var outVal = tl.getDelimitedInput('delim', ' ', /*required*/false);
            assert.equal(outVal.length, 0, 'should return array with zero elements');

            done();
        })

        // getPathInput tests
        it('gets path input value', function (done) {
            this.timeout(1000);

            var inputValue = 'test.txt'
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/false);
            assert(path, 'should return a path');
            assert.equal(path, inputValue, 'test path value');

            done();
        })
        it('throws if required path not supplied', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);

            var worked: boolean = false;
            try {
                var path = tl.getPathInput(null, /*required=*/true, /*check=*/false);
                worked = true;
            }
            catch (err) { }

            assert(!worked, 'req path should have not have worked');

            done();
        })
        it('get invalid checked path throws', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);

            var worked: boolean = false;
            try {
                var path = tl.getPathInput('some_missing_path', /*required=*/true, /*check=*/true);
                worked = true;
            }
            catch (err) { }

            assert(!worked, 'invalid checked path should have not have worked');

            done();
        })
        it('gets path invalid value not required', function (done) {
            this.timeout(1000);

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var path = tl.getPathInput('some_missing_path', /*required=*/false, /*check=*/false);
            assert(!path, 'should not return a path');

            var errMsg = errStream.getContents();
            assert.equal(errMsg, "", "no err")

            done();
        })
        it('gets path input value with space', function (done) {
            this.timeout(1000);

            var inputValue = 'file name.txt';
            var expectedValue = 'file name.txt';
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/false);
            assert(path, 'should return a path');
            assert.equal(path, expectedValue, 'returned ' + path + ', expected: ' + expectedValue);

            done();
        })
        it('gets path value with check and exist', function (done) {
            this.timeout(1000);

            var errStream = new StringStream();
            tl.setErrStream(errStream);

            var inputValue = __filename;
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/true);
            assert(path, 'should return a path');
            assert.equal(path, inputValue, 'test path value');

            var errMsg = errStream.getContents();
            assert(errMsg === "", "no err")

            done();
        })
        it('gets path value with check and not exist', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);

            var inputValue = "someRandomFile.txt";
            process.env['INPUT_PATH1'] = inputValue;
            tl._loadData();

            var worked: boolean = false;
            try {
                var path = tl.getPathInput('path1', /*required=*/true, /*check=*/true);
                worked = true;
            }
            catch (err) {
                assert(err.message.indexOf("Not found") >= 0, "error should have said Not found");
            }
            assert(!worked, 'invalid checked path should have not have worked');

            done();
        })

        // filePathSupplied tests
        it('filePathSupplied checks not supplied', function (done) {
            this.timeout(1000);

            var repoRoot = '/repo/root/dir';
            process.env['INPUT_PATH1'] = repoRoot;
            tl._loadData();

            process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
            var supplied = tl.filePathSupplied('path1');
            assert(!supplied, 'path1 should not be supplied');
            done();
        })
        it('filePathSupplied checks supplied', function (done) {
            this.timeout(1000);

            var repoRoot = '/repo/root/dir';
            process.env['INPUT_PATH1'] = repoRoot + '/some/path';
            tl._loadData();

            process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
            var supplied = tl.filePathSupplied('path1');
            assert(supplied, 'path1 should be supplied');
            done();
        })

        //resolve tests
        it('resolve', function(done) {
            var absolutePath = tl.resolve('/repo/root', '/repo/root/some/path');
            if(os.platform() !== 'win32') {
                assert(absolutePath === '/repo/root/some/path', 'absolute path not expected, got:' + absolutePath + ' expected: /repo/root/some/path');
            } else {
                var winDrive = path.parse(path.resolve('')).root;
                var expectedPath = winDrive.concat('repo\\root\\some\\path');
                assert.equal(absolutePath, expectedPath, 'absolute path not as expected, got: ' + absolutePath + ' expected: ' + expectedPath);
            }
            done();
        })
    });

    describe('TaskCommands', function () {
        it('constructs', function (done) {
            this.timeout(1000);

            assert(tcm.TaskCommand, 'TaskCommand should be available');
            var tc = new tcm.TaskCommand('some.cmd', { foo: 'bar' }, 'a message');
            assert(tc, 'TaskCommand constructor works');

            done();
        })
        it('toStrings', function (done) {
            this.timeout(1000);

            var tc = new tcm.TaskCommand('some.cmd', { foo: 'bar' }, 'a message');
            assert(tc, 'TaskCommand constructor works');
            var cmdStr = tc.toString();
            assert.equal(cmdStr, '##vso[some.cmd foo=bar;]a message');
            done();
        })
        it('handles null properties', function (done) {
            this.timeout(1000);

            var tc = new tcm.TaskCommand('some.cmd', null, 'a message');
            assert.equal(tc.toString(), '##vso[some.cmd]a message');
            done();
        })
        it('parses cmd with no properties', function (done) {
            var cmdStr = '##vso[basic.command]messageVal';

            var tc = tcm.commandFromString(cmdStr);

            assert(tc.command === 'basic.command', 'cmd should be correct');
            assert(Object.keys(tc.properties).length == 0, 'should have no properties.');
            assert.equal(tc.message, 'messageVal', 'message is correct');
            done();
        })
        it('parses basic cmd with values', function (done) {
            var cmdStr = '##vso[basic.command prop1=val1;]messageVal';

            var tc = tcm.commandFromString(cmdStr);

            assert(tc.command === 'basic.command', 'cmd should be correct');
            assert(tc.properties['prop1'], 'should be a property names prop1');
            assert.equal(Object.keys(tc.properties).length, 1, 'should have one property.');
            assert.equal(tc.properties['prop1'], 'val1', 'property value is correct');
            assert.equal(tc.message, 'messageVal', 'message is correct');
            done();
        })
        it('parses basic cmd with multiple properties no trailing semi', function (done) {
            var cmdStr = '##vso[basic.command prop1=val1;prop2=val2]messageVal';

            var tc = tcm.commandFromString(cmdStr);

            assert(tc.command === 'basic.command', 'cmd should be correct');
            assert(tc.properties['prop1'], 'should be a property names prop1');
            assert.equal(Object.keys(tc.properties).length, 2, 'should have one property.');
            assert.equal(tc.properties['prop1'], 'val1', 'property value is correct');
            assert.equal(tc.properties['prop2'], 'val2', 'property value is correct');
            assert.equal(tc.message, 'messageVal', 'message is correct');
            done();
        })
        it('parses values with spaces in them', function (done) {
            var cmdStr = '##vso[task.setvariable variable=task variable;]task variable set value';

            var tc = tcm.commandFromString(cmdStr);
            assert.equal(tc.command, 'task.setvariable', 'cmd should be task.setvariable');
            assert(tc.properties['variable'], 'should be a property names variable');
            assert.equal(tc.properties['variable'], 'task variable', 'property variable is correct');
            assert.equal(tc.message, 'task variable set value');
            done();
        })
        it('handles empty properties', function (done) {
            this.timeout(1000);

            var tc = new tcm.TaskCommand('some.cmd', {}, 'a message');
            assert.equal(tc.toString(), '##vso[some.cmd]a message');
            done();
        })
    });

    describe('TaskLibCommands', function () {
        it('setResult success outputs', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            tl.setResult(tl.TaskResult.Succeeded, 'success msg');

            var expected = _buildOutput(
                ['##vso[task.debug]task result: Succeeded',
                    '##vso[task.complete result=Succeeded;]success msg']);

            var output = stdStream.getContents();

            assert.equal(output, expected);

            done();
        })
        it('setResult failed outputs', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            tl.setResult(tl.TaskResult.Failed, 'failed msg');

            var expected = _buildOutput(
                ['##vso[task.debug]task result: Failed',
                    '##vso[task.issue type=error;]failed msg',
                    '##vso[task.complete result=Failed;]failed msg']);

            var output = stdStream.getContents();

            assert.equal(output, expected);

            done();
        })
        it('setResult failed does not create issue with empty message', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            tl.setResult(tl.TaskResult.Failed, '');

            var expected = _buildOutput(
                ['##vso[task.debug]task result: Failed',
                    '##vso[task.complete result=Failed;]']);

            var output = stdStream.getContents();

            assert.equal(output, expected);

            done();
        })
    });

    describe('Disk operations', function() {
        it('check exist functionality for existing file', function (done) {
            this.timeout(1000);

            tl.mkdirP(_testTemp);
            var fileName = path.join(_testTemp, "test.txt");
            fs.writeFileSync(fileName, "");

            assert(tl.exist(fileName), "file should exists"); //check existance of file
            fs.unlinkSync(fileName);
            done();
        });

        it('check exist functionality for non existing file', function (done) {
            this.timeout(1000);

            var fileName = path.join(_testTemp, "test.txt");
            assert(!tl.exist(fileName), "file shouldn't be existing");
            done();
        });

        it('write file functionality for valid file path', function (done) {
            this.timeout(1000);

            var fileName = path.join(_testTemp, "writeFileTest.txt");
            tl.writeFile(fileName, "testing writefile method");
            assert(tl.exist(fileName), "writeFile should create the file");
            done();
        })

        it('write file functionality with options', function (done) {
            var fileName = path.join(_testTemp, "writeFileTest.txt");
            tl.writeFile(fileName, "testing writeFile() with encoding", 'utf-8');
            assert(fs.readFileSync(fileName, 'utf-8') === "testing writeFile() with encoding", "writeFile should create file with correct options");
            done();
        })
    })

    describe('Vault', function () {
        it('Can create vault', function (done) {
            var vault: vm.Vault = new vm.Vault(process.cwd());

            assert(vault, 'should have created a vault object');

            done();
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

    describe('ToolRunner', function () {
        it('ExecSync convenience with stdout', function (done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                var ret = tl.execSync('cmd', '/c echo \'vsts-task-lib\'', _testExecOptions);
                assert.equal(ret.code, 0, 'return code of cmd should be 0');
            }
            else {
                var ret = tl.execSync('ls', '-l -a', _testExecOptions);
                assert.equal(ret.code, 0, 'return code of ls should be 0');
            }

            assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
            tl.popd();
            done();
        })
        it('ExecSync with stdout', function (done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                var cmd = tl.tool(tl.which('cmd', true));
                cmd.arg('/c echo \'vsts-task-lib\'');

                var ret = cmd.execSync(_testExecOptions);
                assert.equal(ret.code, 0, 'return code of cmd should be 0');
            }
            else {
                var ls = tl.tool(tl.which('ls', true));
                ls.arg('-l');
                ls.arg('-a');

                var ret = ls.execSync(_testExecOptions);
                assert.equal(ret.code, 0, 'return code of ls should be 0');
            }

            assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
            tl.popd();
            done();
        })
        it('ExecSync fails with rc 1 and stderr', function (done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            var tool;
            if (plat === 'win32') {
                tool = tl.tool(tl.which('cmd', true));
                tool.arg('/c');
                tool.arg('echo hello from stderr 1>&2 && exit 123');
            }
            else {
                tool = tl.tool(tl.which('bash', true));
                tool.arg('-c');
                tool.arg('echo hello from stderr 1>&2 ; exit 123');
            }

            var ret = tool.execSync(_testExecOptions);
            assert.equal(ret.code, 123, 'return code of tool should be 1');
            assert.equal(ret.stderr.toString().trim(), 'hello from stderr');
            tl.popd();
            done();
        })
        it('Exec convenience with stdout', function (done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                tl.exec('cmd', '/c echo \'vsts-task-lib\'', _testExecOptions)
                    .then(function (code) {
                        assert.equal(code, 0, 'return code of cmd should be 0');
                    })
                    .fail(function (err) {
                        assert.fail('cmd failed to run: ' + err.message);
                    })
                    .fin(function () {
                        tl.popd();
                        done();
                    })
            }
            else {
                tl.exec('ls', '-l -a', _testExecOptions)
                    .then(function (code) {
                        assert.equal(code, 0, 'return code of ls should be 0');
                    })
                    .fail(function (err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function () {
                        tl.popd();
                        done();
                    })
            }
        })
        it('ToolRunner writes debug', function (done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            if (plat === 'win32') {
                var cmdPath = tl.which('cmd', true);
                var cmd = tl.tool(cmdPath);
                cmd.arg('/c echo \'vsts-task-lib\'');

                cmd.exec(_testExecOptions)
                    .then(function (code) {
                        var contents = stdStream.getContents();
                        assert(contents.indexOf('exec tool: ' + cmdPath) >= 0, 'should exec cmd');
                        assert.equal(code, 0, 'return code of cmd should be 0');
                    })
                    .fail(function (err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function () {
                        tl.popd();
                        done();
                    })
            }
            else {
                var ls = tl.tool(tl.which('ls', true));
                ls.arg('-l');
                ls.arg('-a');

                ls.exec(_testExecOptions)
                    .then(function (code) {
                        var contents = stdStream.getContents();
                        assert(contents.indexOf('exec tool: /bin/ls') >= 0, 'should exec ls');
                        assert.equal(code, 0, 'return code of ls should be 0');
                    })
                    .fail(function (err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function () {
                        tl.popd();
                        done();
                    })
            }
        })
        it('Execs with stdout', function (done) {
            this.timeout(1000);

            tl.pushd(__dirname);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            var output = '';
            if (plat === 'win32') {
                var cmd = tl.tool(tl.which('cmd', true));
                cmd.arg('/c  echo \'vsts-task-lib\'');

                cmd.on('stdout', (data) => {
                    output = data.toString();
                });

                cmd.exec(_testExecOptions)
                    .then(function (code) {
                        assert.equal(code, 0, 'return code of cmd should be 0');
                        assert(output && output.length > 0, 'should have emitted stdout');
                    })
                    .fail(function (err) {
                        assert.fail('cmd failed to run: ' + err.message);
                    })
                    .fin(function () {
                        tl.popd();
                        done();
                    })
            }
            else {
                var ls = tl.tool(tl.which('ls', true));
                ls.arg('-l');
                ls.arg('-a');

                ls.on('stdout', (data) => {
                    output = data.toString();
                });

                ls.exec(_testExecOptions)
                    .then(function (code) {
                        assert.equal(code, 0, 'return code of ls should be 0');
                        assert(output && output.length > 0, 'should have emitted stdout');
                    })
                    .fail(function (err) {
                        assert.fail('ls failed to run: ' + err.message);
                    })
                    .fin(function () {
                        tl.popd();
                        done();
                    })
            }
        })
        it('Fails on return code 1 with stderr', function (done) {
            this.timeout(1000);

            var failed = false;

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }

            var output = '';
            if (plat === 'win32') {
                var cmd = tl.tool(tl.which('cmd', true));
                cmd.arg('/c notExist');

                cmd.on('stderr', (data) => {
                    output = data.toString();
                });

                cmd.exec(_testExecOptions)
                    .then(function (code) {
                        assert(code === 1, 'return code of cmd should be 1');
                        assert(output && output.length > 0, 'should have emitted stderr');
                    })
                    .fail(function (err) {
                        failed = true;
                    })
                    .fin(function () {
                        if (!failed) {
                            done(new Error('cmd should have failed'));
                            return;
                        }

                        done();
                    })
            }
            else {
                var ls = tl.tool(tl.which('ls', true));
                ls.arg('-j');

                ls.on('stderr', (data) => {
                    output = data.toString();
                });

                ls.exec(_testExecOptions)
                    .then(function (code) {
                        assert.equal(code, 1, 'return code of ls -j should be 1');
                        assert(output && output.length > 0, 'should have emitted stderr');
                    })
                    .fail(function (err) {
                        failed = true;
                    })
                    .fin(function () {
                        if (!failed) {
                            done(new Error('ls should have failed'));
                            return;
                        }

                        done();
                    })
            }
        })
        it('Succeeds on stderr by default', function (done) {
            this.timeout(1000);

            var scriptPath = path.join(__dirname, 'scripts', 'stderroutput.js');
            var ls = tl.tool(tl.which('node', true));
            ls.arg(scriptPath);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }
            ls.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'should have succeeded on stderr');
                    done();
                })
                .fail(function (err) {
                    done(new Error('did not succeed on stderr'))
                })
        })
        it('Fails on stderr if specified', function (done) {
            this.timeout(1000);

            var failed = false;

            var scriptPath = path.join(__dirname, 'scripts', 'stderrOutput.js');
            var ls = tl.tool(tl.which('node', true));
            ls.arg(scriptPath);

            var _testExecOptions: trm.IExecOptions = {
                cwd: __dirname,
                env: {},
                silent: false,
                failOnStdErr: true,
                ignoreReturnCode: false,
                outStream: _nullTestStream,
                errStream: _nullTestStream
            }
            ls.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'should have succeeded on stderr');
                })
                .fail(function (err) {
                    failed = true;
                })
                .fin(function () {
                    if (!failed) {
                        done(new Error('should have failed on stderr'));
                        return;
                    }

                    done();
                })
        })
        it('handles single args', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.arg('one');
            node.arg('two');
            assert.equal(node.args.length, 2, 'should have 2 args');
            assert.equal(node.args.toString(), 'one,two', 'should be one,two');
            done();
        })
        it('handles arg chaining', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.arg('one').arg('two').argIf(true, 'three').line('four five');
            //node.arg('one').arg('two').argIf(true, 'three');
            assert.equal(node.args.length, 5, 'should have 5 args');
            assert.equal(node.args.toString(), 'one,two,three,four,five', 'should be one,two,three,four,five');
            done();
        })        
        it('handles padded spaces', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.arg(' one ');
            node.arg('two');
            assert.equal(node.args.length, 2, 'should have 2 args');
            assert.equal(node.args.toString(), 'one,two', 'should be one,two');
            done();
        })
        it('handles basic arg string with spaces', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.line('one two');
            node.arg('three');
            assert.equal(node.args.length, 3, 'should have 3 args');
            assert.equal(node.args.toString(), 'one,two,three', 'should be one,two,three');
            done();
        })
        it('handles arg string with extra spaces', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.line('one   two');
            node.arg('three');
            assert.equal(node.args.length, 3, 'should have 3 args');
            assert.equal(node.args.toString(), 'one,two,three', 'should be one,two,three');
            done();
        })
        it('handles arg string with backslash', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.line('one two\\arg');
            node.arg('three');
            assert.equal(node.args.length, 3, 'should have 3 args');
            assert.equal(node.args.toString(), 'one,two\\arg,three', 'should be one,two,three');
            done();
        })
        it('handles equals and switches', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.line('foo=bar -x');
            node.arg('-y');
            assert.equal(node.args.length, 3, 'should have 3 args');
            assert.equal(node.args.toString(), 'foo=bar,-x,-y', 'should be foo=bar,-x,-y');
            done();
        })
        it('handles double quotes', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.line('foo="bar baz" -x');
            node.arg('-y');
            assert.equal(node.args.length, 3, 'should have 3 args');
            assert.equal(node.args.toString(), 'foo=bar baz,-x,-y', 'should be foo=bar baz,-x,-y');
            done();
        })
        it('handles quote in double quotes', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.line('foo="bar \\" baz" -x');
            node.arg('-y');
            assert.equal(node.args.length, 3, 'should have 3 args');
            assert.equal(node.args.toString(), 'foo=bar " baz,-x,-y', 'should be foo=bar " baz,-x,-y');
            done();
        })
        it('handles literal path', function (done) {
            this.timeout(1000);

            var node = tl.tool(tl.which('node', true));
            node.arg('--path').arg('/bin/working folder1');
            assert.equal(node.args.length, 2, 'should have 2 args');
            assert.equal(node.args.toString(), '--path,/bin/working folder1', 'should be --path /bin/working folder1');
            done();
        })
    });

    describe('Codecoverage commands', function () {
        it('publish code coverage passes all the properties properly', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish("Jacoco", "\\user\\admin\\summary.xml", "\\user\\admin\\report", "\\user\\admin\\report\\t.xml,\\user\\admin\\report\\c.xml");

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.publish codecoveragetool=Jacoco;summaryfile=\\user\\admin\\summary.xml;reportdirectory=\\user\\admin\\report;additionalcodecoveragefiles=\\user\\admin\\report\\t.xml,\\user\\admin\\report\\c.xml;]"]);
            assert.equal(expectedOutput, output);
            done();
        })

        it('publish code coverage does not pass properties when the imput parameters are empty', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish("", "", "", "");

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.publish]"]);
            assert.equal(expectedOutput, output);
            done();
        })

        it('publish code coverage does not pass properties when the input parameters are null', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccPublisher = new tl.CodeCoveragePublisher();
            ccPublisher.publish(null, null, null, null);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.publish]"]);
            assert.equal(expectedOutput, output);
            done();
        })

        it('enable code coverage does not pass properties when the input parameters are null', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccEnabler = new tl.CodeCoverageEnabler(null, null);
            var buildProps: { [key: string]: string } = {};
            ccEnabler.enableCodeCoverage(buildProps);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.enable ]"]);
            assert.equal(expectedOutput, output);
            done();
        })

        it('enable code coverage passes properties when the input parameters are existing', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccEnabler = new tl.CodeCoverageEnabler("jacoco", "buildtool");
            var buildProps: { [key: string]: string } = {};
            buildProps['abc'] = 'xyz';
            ccEnabler.enableCodeCoverage(buildProps);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.enable abc=xyz;buildtool=jacoco;codecoveragetool=buildtool;]"]);
            assert.equal(expectedOutput, output);
            done();
        })

        it('enable code coverage passes parameters when the input parameters are empty', function (done) {
            this.timeout(1000);

            var stdStream = new StringStream();
            tl.setStdStream(stdStream);
            var ccEnabler = new tl.CodeCoverageEnabler("jacoco", "buildtool");
            var buildProps: { [key: string]: string } = {};
            ccEnabler.enableCodeCoverage(buildProps);

            var output = stdStream.getContents();
            var expectedOutput = _buildOutput(["##vso[codecoverage.enable buildtool=jacoco;codecoveragetool=buildtool;]"]);
            assert.equal(expectedOutput, output);
            done();
        })

    })

    describe('Localization', function () {
        it('validate loc string key in lib.json', function (done) {
            this.timeout(1000);

            var jsonPath = path.join(__dirname, '../lib.json');
            var json = require(jsonPath);
            if (json && json.hasOwnProperty('messages')) {
                for (var key in json.messages) {
                    assert(key.search(/\W+/gi) < 0, ('messages key: \'' + key + '\' contain non-word characters, only allows [a-zA-Z0-9_].'));
                    assert(key.search(/^LIB_/) === 0, ('messages key: \'' + key + '\' should start with \'LIB_\'.'));
                    if (typeof (json.messages[key]) === 'object') {
                        assert(false, ('messages key: \'' + key + '\' should have a loc string, not a object.'));
                    }
                    else if (typeof (json.messages[key]) === 'string') {
                        assert(json.messages[key].toString().length > 0, ('messages key: \'' + key + '\' should have a loc string.'));
                    }
                }
            }

            done();
        })
        it('get loc string from loc resources.json', function (done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            var tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'zh-CN');
            shell.mkdir('-p', tempLocFolder);
            var locJsonStr = "{\"loc.messages.key1\" : \"loc cn-string for key 1.\", \"loc.messages.key2\" : \"loc cn-string for key %d.\", \"loc.messages.key3\" : \"loc cn-string for key %%.\"}";
            var locJsonPath = path.join(tempLocFolder, 'resources.resjson');
            fs.writeFileSync(locJsonPath, locJsonStr);

            process.env['SYSTEM_CULTURE'] = 'ZH-cn'; // Lib should handle casing differences for culture.

            tl.setResourcePath(jsonPath);

            assert.equal(tl.loc('key1'), 'loc cn-string for key 1.', 'string not found for key.');
            assert.equal(tl.loc('key2', 2), 'loc cn-string for key 2.', 'string not found for key.');
            assert.equal(tl.loc('key3'), 'loc cn-string for key %%.', 'string not found for key.');

            done();
        })
        it('fallback to current string if culture resources.resjson not found', function (done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            process.env['SYSTEM_CULTURE'] = 'zh-CN';

            tl.setResourcePath(jsonPath);
            assert.equal(tl.loc('key2', 2), 'string for key 2.', 'en-US fallback string not return for key.');

            done();
        })
        it('fallback to current string if loc string not found in culture resources.resjson', function (done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            var tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'zh-CN');
            shell.mkdir('-p', tempLocFolder);
            var locJsonStr = "{\"loc.messages.key1\" : \"loc cn-string for key 1.\", \"loc.messages.key3\" : \"loc cn-string for key %%.\"}";
            var locJsonPath = path.join(tempLocFolder, 'resources.resjson');
            fs.writeFileSync(locJsonPath, locJsonStr);

            process.env['SYSTEM_CULTURE'] = 'zh-CN';

            tl.setResourcePath(jsonPath);
            assert.equal(tl.loc('key2', 2), 'string for key 2.', 'en-US fallback string not return for key.');

            done();
        })
        it('fallback to en-US if culture not set', function (done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\", \"key3\" : \"string for key %%.\"}}";
            var jsonPath = path.join(tempFolder, 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            var tempLocFolder = path.join(tempFolder, 'Strings', 'resources.resjson', 'en-US');
            shell.mkdir('-p', tempLocFolder);
            var locJsonStr = "{\"loc.messages.key1\" : \"loc en-string for key 1.\", \"loc.messages.key2\" : \"loc en-string for key %d.\", \"loc.messages.key3\" : \"loc en-string for key %%.\"}";
            var locJsonPath = path.join(tempLocFolder, 'resources.resjson');
            fs.writeFileSync(locJsonPath, locJsonStr);

            process.env['SYSTEM_CULTURE'] = '';

            tl.setResourcePath(jsonPath);
            assert.equal(tl.loc('key2', 2), 'loc en-string for key 2.', 'en-US fallback string not return for key.');

            done();
        })
        it('return key and params if key is not in task.json', function (done) {
            this.timeout(1000);

            var tempFolder = path.join(__dirname, Math.floor(Math.random() * 100).toString());
            shell.mkdir('-p', tempFolder);
            var jsonStr = "{\"messages\": {\"key1\" : \"string for key 1.\", \"key2\" : \"string for key %d.\"}}";
            var jsonPath = path.join(tempFolder + 'task.json');
            fs.writeFileSync(jsonPath, jsonStr);

            tl.setResourcePath(jsonPath);
            assert.equal(tl.loc('key3', 3), 'key3 3', 'key and params not return for non-exist key.');

            done();
        })
    });

    describe('Minimatch', () => {
        it('aggregates matches', (done: MochaDone) => {
            this.timeout(1000);

            let list: string[] = [
                '/projects/myproj1/myproj1.proj',
                '/projects/myproj2/myproj2.proj',
                '/projects/myproj3/myproj3.proj'
            ];
            let patterns: string[] = [
                '/projects/**/myproj1.proj',
                '/projects/**/myproj2.proj'
            ];
            let options = { matchBase: true };
            let result: string[] = tl.match(list, patterns, options);
            assert.equal(result.length, 2);
            assert.equal(result[0], '/projects/myproj1/myproj1.proj');
            assert.equal(result[1], '/projects/myproj2/myproj2.proj');

            done();
        });

        it('does not duplicate matches', (done: MochaDone) => {
            this.timeout(1000);

            let list: string[] = [
                '/included/file1.proj',
                '/included/file2.proj',
                '/not_included/readme.txt'
            ];
            let patterns: string[] = [
                '/included/**', // both patterns match the same files
                '/**/*.proj'
            ];
            let options = { matchBase: true };
            let result: string[] = tl.match(list, patterns, options);
            assert.equal(result.length, 2);
            assert.equal(result[0], '/included/file1.proj');
            assert.equal(result[1], '/included/file2.proj');

            done();
        });

        it('preserves order', (done: MochaDone) => {
            this.timeout(1000);

            let list: string[] = [
                '/projects/myproj1/myproj1.proj',
                '/projects/myproj2/myproj2.proj',
                '/projects/myproj3/myproj3.proj',
                '/projects/myproj4/myproj4.proj',
                '/projects/myproj5/myproj5.proj'
            ];
            let patterns: string[] = [
                '/projects/**/myproj2.proj', // mix up the order
                '/projects/**/myproj5.proj',
                '/projects/**/myproj3.proj',
                '/projects/**/myproj1.proj',
                '/projects/**/myproj4.proj',
            ];
            let options = { matchBase: true };
            let result: string[] = tl.match(list, patterns, options);
            assert.equal(result.length, 5);
            assert.equal(result[0], '/projects/myproj1/myproj1.proj'); // should follow original list order
            assert.equal(result[1], '/projects/myproj2/myproj2.proj');
            assert.equal(result[2], '/projects/myproj3/myproj3.proj');
            assert.equal(result[3], '/projects/myproj4/myproj4.proj');
            assert.equal(result[4], '/projects/myproj5/myproj5.proj');

            done();
        });
    });
});
