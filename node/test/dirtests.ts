/// <reference path="../typings/index.d.ts" />
/// <reference path="../_build/task.d.ts" />

import assert = require('assert');
import path = require('path');
import fs = require('fs');
import shell = require('shelljs');
import os = require('os');
import * as tl from '../_build/task';

import * as testutil from './testutil';

describe('Dir Operation Tests', function () {
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

    // this test verifies the expected version of node is being used to run the tests.
    // 5.10.1 is what ships in the 1.x and 2.x agent.
    it('is expected version', (done: MochaDone) => {
        this.timeout(1000);

        assert.equal(process.version, 'v5.10.1');

        done();
    });

    // which tests
    it('which() on windows return file with Extension', function (done) {
        this.timeout(1000);

        if (os.type().match(/^Win/)) {
            var testPath = path.join(testutil.getTestTemp(), 'whichTest');
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

    // find tests
    it('returns hidden files with find', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   find_hidden_files
        //   find_hidden_files/.emptyFolder
        //   find_hidden_files/.file
        //   find_hidden_files/.folder
        //   find_hidden_files/.folder/file
        let root: string = path.join(testutil.getTestTemp(), 'find_hidden_files');
        testutil.createHiddenDirectory(path.join(root, '.emptyFolder'));
        testutil.createHiddenDirectory(path.join(root, '.folder'));
        testutil.createHiddenFile(path.join(root, '.file'), 'test .file content');
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
        let root: string = path.join(testutil.getTestTemp(), 'find_depth_first');
        tl.mkdirP(path.join(root, 'b_folder', 'b_folder'));
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

        let itemPaths: string[] = tl.find(path.join(testutil.getTestTemp(), 'nosuch'));
        assert.equal(0, itemPaths.length);

        done();
    });

    it('does not follow specified symlink', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   realDir
        //   realDir/file
        //   symDir -> realDir
        let root: string = path.join(testutil.getTestTemp(), 'find_no_follow_specified_symlink');
        tl.mkdirP(path.join(root, 'realDir'));
        fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
        testutil.createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

        let itemPaths: string[] = tl.find(path.join(root, 'symDir'), <tl.FindOptions>{ });
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
        let root: string = path.join(testutil.getTestTemp(), 'find_follow_specified_symlink_when_-H');
        tl.mkdirP(path.join(root, 'realDir'));
        fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
        testutil.createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

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
        let root: string = path.join(testutil.getTestTemp(), 'find_follow_specified_symlink_when_-L');
        tl.mkdirP(path.join(root, 'realDir'));
        fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
        testutil.createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

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
        let root: string = path.join(testutil.getTestTemp(), 'find_no_follow_symlink');
        tl.mkdirP(path.join(root, 'realDir'));
        fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
        testutil.createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

        let itemPaths: string[] = tl.find(root, <tl.FindOptions>{ });
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
        let root: string = path.join(testutil.getTestTemp(), 'find_no_follow_symlink_when_-H');
        tl.mkdirP(path.join(root, 'realDir'));
        fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
        testutil.createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

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
        let root: string = path.join(testutil.getTestTemp(), 'find_follow_symlink_when_-L');
        tl.mkdirP(path.join(root, 'realDir'));
        fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
        testutil.createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

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
        let root: string = path.join(testutil.getTestTemp(), 'find_detects_cycle');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'file'), 'test file content');
        testutil.createSymlinkDir(root, path.join(root, 'symDir'));

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
        let root: string = path.join(testutil.getTestTemp(), 'find_detects_cycle_starting_from_symlink');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, 'file'), 'test file content');
        testutil.createSymlinkDir(root, path.join(root, 'symDir'));

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
        let root: string = path.join(testutil.getTestTemp(), 'find_detects_deep_cycle_starting_from_middle');
        tl.mkdirP(path.join(root, 'folder_a', 'folder_b', 'folder_c'));
        fs.writeFileSync(path.join(root, 'file_under_root'), 'test file under root contents');
        fs.writeFileSync(path.join(root, 'folder_a', 'file_under_a'), 'test file under a contents');
        fs.writeFileSync(path.join(root, 'folder_a', 'folder_b', 'file_under_b'), 'test file under b contents');
        fs.writeFileSync(path.join(root, 'folder_a', 'folder_b', 'folder_c', 'file_under_c'), 'test file under c contents');
        testutil.createSymlinkDir(root, path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder'));
        assert.doesNotThrow(
            () => fs.statSync(path.join(root, 'folder_a', 'folder_b', 'folder_c', 'sym_folder', 'file_under_root')),
            'symlink_folder should be created properly');

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

    it('applies default options', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   <root>
        //   <root>/real_folder
        //   <root>/real_folder/file_under_real_folder
        //   <root>/sym_folder -> real_folder
        let root: string = path.join(testutil.getTestTemp(), 'find_applies_default_options');
        tl.mkdirP(path.join(root, 'real_folder'));
        fs.writeFileSync(path.join(root, 'real_folder', 'file_under_real_folder'), 'test file under real folder');
        testutil.createSymlinkDir(path.join(root, 'real_folder'), path.join(root, 'sym_folder'));
        assert.doesNotThrow(
            () => fs.statSync(path.join(root, 'sym_folder', 'file_under_real_folder')),
            'sym_folder should be created properly');

        let actual: string[] = tl.find(root);
        let expected: string[] = [
            root,
            path.join(root, 'real_folder'),
            path.join(root, 'real_folder', 'file_under_real_folder'),
            path.join(root, 'sym_folder'),
            path.join(root, 'sym_folder', 'file_under_real_folder'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    it('empty find path returns empty array', (done: MochaDone) => {
        this.timeout(1000);

        let actual: string[] = tl.find('');
        assert.equal(typeof actual, 'object');
        assert.equal(actual.length, 0);

        done();
    });

    it('normalizes find path', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   <root>/hello/world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find_normalizes_separators');
        tl.mkdirP(path.join(root, 'hello'));
        fs.writeFileSync(path.join(root, 'hello', 'world.txt'), '');

        let actual: string[] = tl.find(root + path.sep + path.sep + path.sep + 'nosuch' + path.sep + '..' + path.sep + 'hello');
        let expected: string[] = [
            path.join(root, 'hello'),
            path.join(root, 'hello', 'world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });

    // mkdirP tests
    it('creates folder with mkdirP', function (done) {
        this.timeout(1000);

        var testPath = path.join(testutil.getTestTemp(), 'mkdirTest');
        tl.mkdirP(testPath);
        assert(shell.test('-d', testPath), 'directory created');

        done();
    });

    it('creates nested folders with mkdirP', function (done) {
        this.timeout(1000);

        var testPath = path.join(testutil.getTestTemp(), 'mkdir1', 'mkdir2');
        tl.mkdirP(testPath);
        assert(shell.test('-d', testPath), 'directory created');

        done();
    });

    it('fails if mkdirP with illegal chars', function (done) {
        this.timeout(1000);

        var testPath = path.join(testutil.getTestTemp(), 'mkdir\0');
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

        let testPath = path.join(testutil.getTestTemp(), 'mkdirP_conflicting_file_path');
        shell.mkdir('-p', testutil.getTestTemp());
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

        let testPath = path.join(testutil.getTestTemp(), 'mkdirP_conflicting_parent_file_path', 'dir');
        shell.mkdir('-p', testutil.getTestTemp());
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

        let testPath = path.join(testutil.getTestTemp(), 'mkdirP_dir_exists');
        shell.mkdir('-p', testutil.getTestTemp());
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
        let rootPath = path.join(testutil.getTestTemp(), 'mkdirP_symlink_dir');
        let realDirPath = path.join(rootPath, 'real_dir');
        let realFilePath = path.join(realDirPath, 'file.txt');
        let symlinkDirPath = path.join(rootPath, 'symlink_dir');
        shell.mkdir('-p', testutil.getTestTemp());
        fs.mkdirSync(rootPath);
        fs.mkdirSync(realDirPath);
        fs.writeFileSync(realFilePath, 'test real_dir/file.txt contet');
        testutil.createSymlinkDir(realDirPath, symlinkDirPath);

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
        let rootPath = path.join(testutil.getTestTemp(), 'mkdirP_parent_symlink_dir');
        let realDirPath = path.join(rootPath, 'real_dir');
        let realFilePath = path.join(realDirPath, 'file.txt');
        let symlinkDirPath = path.join(rootPath, 'symlink_dir');
        shell.mkdir('-p', testutil.getTestTemp());
        fs.mkdirSync(rootPath);
        fs.mkdirSync(realDirPath);
        fs.writeFileSync(realFilePath, 'test real_dir/file.txt contet');
        testutil.createSymlinkDir(realDirPath, symlinkDirPath);

        let subDirPath = path.join(symlinkDirPath, 'sub_dir');
        tl.mkdirP(subDirPath);

        // the subdirectory should be accessible via the real directory
        assert.equal(fs.lstatSync(path.join(realDirPath, 'sub_dir')).isDirectory(), true);

        done();
    });

    it('breaks if mkdirP loop out of control', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(testutil.getTestTemp(), 'mkdirP_failsafe', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10');
        process.env['TASKLIB_TEST_MKDIRP_FAILSAFE'] = '10';
        try {
            tl.mkdirP(testPath);
            throw new Error("directory should not have been created");
        }
        catch (err) {
            delete process.env['TASKLIB_TEST_MKDIRP_FAILSAFE'];

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

        var testPath = path.join(testutil.getTestTemp(), 'testFolder');

        tl.mkdirP(testPath);
        assert(shell.test('-d', testPath), 'directory created');
        assert(shell.test('-e', testPath), 'directory exists');

        tl.rmRF(testPath);
        assert(!shell.test('-e', testPath), 'directory removed');

        done();
    });

    it('removes recursive folders with rmRF', function (done) {
        this.timeout(1000);

        var testPath = path.join(testutil.getTestTemp(), 'testDir1');
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

        var testPath = path.join(testutil.getTestTemp(), 'testFolder');
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

        if (os.platform() === 'win32') {
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

        var errStream = testutil.createStringStream();
        tl.setErrStream(errStream);

        tl.rmRF(testPath);
        assert(!shell.test('-e', testPath), 'directory still doesnt exist');

        done();
    });

    it('removes file with rmRF', (done: MochaDone) => {
        this.timeout(1000);

        let file: string = path.join(testutil.getTestTemp(), 'rmRF_file');
        fs.writeFileSync(file, 'test file content');
        assert(shell.test('-f', file), 'file should have been created');
        tl.rmRF(file);
        assert(!shell.test('-e', file), 'file should not exist');

        done();
    });

    it('removes hidden folder with rmRF', (done: MochaDone) => {
        this.timeout(1000);

        let directory: string = path.join(testutil.getTestTemp(), '.rmRF_directory');
        testutil.createHiddenDirectory(directory);
        assert(shell.test('-d', directory), 'directory should have been created');
        tl.rmRF(directory);
        assert(!shell.test('-e', directory), 'directory should not exist');

        done();
    });

    it('removes hidden file with rmRF', (done: MochaDone) => {
        this.timeout(1000);

        let file: string = path.join(testutil.getTestTemp(), '.rmRF_file');
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
        let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_dir_test');
        let realDirectory: string = path.join(root, 'real_directory');
        let realFile: string = path.join(root, 'real_directory', 'real_file');
        let symlinkDirectory: string = path.join(root, 'symlink_directory');
        tl.mkdirP(realDirectory);
        fs.writeFileSync(realFile, 'test file content');
        testutil.createSymlinkDir(realDirectory, symlinkDirectory);
        assert(shell.test('-f', path.join(symlinkDirectory, 'real_file')), 'symlink directory should be created correctly');

        tl.rmRF(symlinkDirectory);
        assert(shell.test('-d', realDirectory), 'real directory should still exist');
        assert(shell.test('-f', realFile), 'file should still exist');
        assert(!shell.test('-e', symlinkDirectory), 'symlink directory should have been deleted');

        done();
    });

    // creating a symlink to a file on Windows requires elevated
    if (os.platform() != 'win32') {
        it('removes symlink file with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   real_file
            //   symlink_file -> real_file
            let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_file_test');
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
            let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_file_missing_source_test');
            let realFile: string = path.join(root, 'real_file');
            let symlinkFile: string = path.join(root, 'symlink_file');
            tl.mkdirP(root);
            fs.writeFileSync(realFile, 'test file content');
            fs.symlinkSync(realFile, symlinkFile);
            assert.equal(fs.readFileSync(symlinkFile), 'test file content');

            // remove the real file
            fs.unlinkSync(realFile);
            assert(fs.lstatSync(symlinkFile).isSymbolicLink(), 'symlink file should still exist');

            // remove the symlink file
            tl.rmRF(symlinkFile);
            let errcode: string;
            try {
                fs.lstatSync(symlinkFile);
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
            let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_level_2_file_test');
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

        it('removes nested symlink file with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   real_directory
            //   real_directory/real_file
            //   outer_directory
            //   outer_directory/symlink_file -> real_file
            let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_nest_file_test');
            let realDirectory: string = path.join(root, 'real_directory');
            let realFile: string = path.join(root, 'real_directory', 'real_file');
            let outerDirectory: string = path.join(root, 'outer_directory');
            let symlinkFile: string = path.join(root, 'outer_directory', 'symlink_file');
            tl.mkdirP(realDirectory);
            fs.writeFileSync(realFile, 'test file content');
            tl.mkdirP(outerDirectory);
            fs.symlinkSync(realFile, symlinkFile);
            assert.equal(fs.readFileSync(symlinkFile), 'test file content');

            tl.rmRF(outerDirectory);
            assert(shell.test('-d', realDirectory), 'real directory should still exist');
            assert(shell.test('-f', realFile), 'file should still exist');
            assert(!shell.test('-e', symlinkFile), 'symlink file should have been deleted');
            assert(!shell.test('-e', outerDirectory), 'outer directory should have been deleted');

            done();
        });

        it('removes deeply nested symlink file with rmRF', (done: MochaDone) => {
            this.timeout(1000);

            // create the following layout:
            //   real_directory
            //   real_directory/real_file
            //   outer_directory
            //   outer_directory/nested_directory
            //   outer_directory/nested_directory/symlink_file -> real_file
            let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_deep_nest_file_test');
            let realDirectory: string = path.join(root, 'real_directory');
            let realFile: string = path.join(root, 'real_directory', 'real_file');
            let outerDirectory: string = path.join(root, 'outer_directory');
            let nestedDirectory: string = path.join(root, 'outer_directory', 'nested_directory');
            let symlinkFile: string = path.join(root, 'outer_directory', 'nested_directory', 'symlink_file');
            tl.mkdirP(realDirectory);
            fs.writeFileSync(realFile, 'test file content');
            tl.mkdirP(nestedDirectory);
            fs.symlinkSync(realFile, symlinkFile);
            assert.equal(fs.readFileSync(symlinkFile), 'test file content');

            tl.rmRF(outerDirectory);
            assert(shell.test('-d', realDirectory), 'real directory should still exist');
            assert(shell.test('-f', realFile), 'file should still exist');
            assert(!shell.test('-e', symlinkFile), 'symlink file should have been deleted');
            assert(!shell.test('-e', outerDirectory), 'outer directory should have been deleted');

            done();
        });
    }

    it('removes symlink folder with missing source using rmRF', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   real_directory
        //   real_directory/real_file
        //   symlink_directory -> real_directory
        let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_dir_miss_src_test');
        let realDirectory: string = path.join(root, 'real_directory');
        let realFile: string = path.join(root, 'real_directory', 'real_file');
        let symlinkDirectory: string = path.join(root, 'symlink_directory');
        tl.mkdirP(realDirectory);
        fs.writeFileSync(realFile, 'test file content');
        testutil.createSymlinkDir(realDirectory, symlinkDirectory);
        assert(shell.test('-f', path.join(symlinkDirectory, 'real_file')), 'symlink directory should be created correctly');

        // remove the real directory
        fs.unlinkSync(realFile);
        fs.rmdirSync(realDirectory);
        assert.throws(() => { fs.statSync(symlinkDirectory) }, (err) => err.code == 'ENOENT', 'stat should throw');

        // remove the symlink directory
        tl.rmRF(symlinkDirectory);
        let errcode: string;
        try {
            fs.lstatSync(symlinkDirectory);
        }
        catch (err) {
            errcode = err.code;
        }

        assert.equal(errcode, 'ENOENT');

        done();
    });

    it('removes symlink level 2 folder with rmRF', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   real_directory
        //   real_directory/real_file
        //   symlink_directory -> real_directory
        //   symlink_level_2_directory -> symlink_directory
        let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_level_2_directory_test');
        let realDirectory: string = path.join(root, 'real_directory');
        let realFile: string = path.join(realDirectory, 'real_file');
        let symlinkDirectory: string = path.join(root, 'symlink_directory');
        let symlinkLevel2Directory: string = path.join(root, 'symlink_level_2_directory');
        tl.mkdirP(realDirectory);
        fs.writeFileSync(realFile, 'test file content');
        testutil.createSymlinkDir(realDirectory, symlinkDirectory);
        testutil.createSymlinkDir(symlinkDirectory, symlinkLevel2Directory);
        assert.equal(fs.readFileSync(path.join(symlinkDirectory, 'real_file')), 'test file content');
        if (os.platform() == 'win32') {
            assert.equal(fs.readlinkSync(symlinkLevel2Directory), symlinkDirectory + '\\');
        }
        else {
            assert.equal(fs.readlinkSync(symlinkLevel2Directory), symlinkDirectory);
        }

        tl.rmRF(symlinkLevel2Directory);
        assert(shell.test('-f', path.join(symlinkDirectory, 'real_file')), 'real file should still exist');
        assert(!shell.test('-e', symlinkLevel2Directory), 'symlink level 2 file should have been deleted');

        done();
    });

    it('removes nested symlink folder with rmRF', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   real_directory
        //   real_directory/real_file
        //   outer_directory
        //   outer_directory/symlink_directory -> real_directory
        let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_nest_dir_test');
        let realDirectory: string = path.join(root, 'real_directory');
        let realFile: string = path.join(root, 'real_directory', 'real_file');
        let outerDirectory: string = path.join(root, 'outer_directory');
        let symlinkDirectory: string = path.join(root, 'outer_directory', 'symlink_directory');
        tl.mkdirP(realDirectory);
        fs.writeFileSync(realFile, 'test file content');
        tl.mkdirP(outerDirectory);
        testutil.createSymlinkDir(realDirectory, symlinkDirectory);
        assert(shell.test('-f', path.join(symlinkDirectory, 'real_file')), 'symlink directory should be created correctly');

        tl.rmRF(outerDirectory);
        assert(shell.test('-d', realDirectory), 'real directory should still exist');
        assert(shell.test('-f', realFile), 'file should still exist');
        assert(!shell.test('-e', symlinkDirectory), 'symlink directory should have been deleted');
        assert(!shell.test('-e', outerDirectory), 'outer directory should have been deleted');

        done();
    });

    it('removes deeply nested symlink folder with rmRF', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   real_directory
        //   real_directory/real_file
        //   outer_directory
        //   outer_directory/nested_directory
        //   outer_directory/nested_directory/symlink_directory -> real_directory
        let root: string = path.join(testutil.getTestTemp(), 'rmRF_sym_deep_nest_dir_test');
        let realDirectory: string = path.join(root, 'real_directory');
        let realFile: string = path.join(root, 'real_directory', 'real_file');
        let outerDirectory: string = path.join(root, 'outer_directory');
        let nestedDirectory: string = path.join(root, 'outer_directory', 'nested_directory');
        let symlinkDirectory: string = path.join(root, 'outer_directory', 'nested_directory', 'symlink_directory');
        tl.mkdirP(realDirectory);
        fs.writeFileSync(realFile, 'test file content');
        tl.mkdirP(nestedDirectory);
        testutil.createSymlinkDir(realDirectory, symlinkDirectory);
        assert(shell.test('-f', path.join(symlinkDirectory, 'real_file')), 'symlink directory should be created correctly');

        tl.rmRF(outerDirectory);
        assert(shell.test('-d', realDirectory), 'real directory should still exist');
        assert(shell.test('-f', realFile), 'file should still exist');
        assert(!shell.test('-e', symlinkDirectory), 'symlink directory should have been deleted');
        assert(!shell.test('-e', outerDirectory), 'outer directory should have been deleted');

        done();
    });

    it('removes hidden file with rmRF', (done: MochaDone) => {
        this.timeout(1000);

        let file: string = path.join(testutil.getTestTemp(), '.rmRF_file');
        tl.mkdirP(path.dirname(file));
        testutil.createHiddenFile(file, 'test file content');
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

        var errStream = testutil.createStringStream();
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

        var errStream = testutil.createStringStream();
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

    // cp tests
    it('copies file using -f', (done: MochaDone) => {
        this.timeout(1000);

        let root: string = path.join(testutil.getTestTemp(), 'cp_with_-f');
        let sourceFile: string = path.join(root, 'cp_source');
        let targetFile: string = path.join(root, 'cp_target');
        tl.mkdirP(root);
        fs.writeFileSync(sourceFile, 'test file content');

        tl.cp(sourceFile, targetFile, '-f');

        assert.equal('test file content', fs.readFileSync(targetFile));

        done();
    });
});