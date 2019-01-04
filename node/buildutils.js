
require('shelljs');
var fs = require('fs');
var os = require('os');
var path = require('path');
var process = require('process');
var syncRequest = require('sync-request');

var downloadPath = path.join(__dirname, '_download');
var testPath = path.join(__dirname, '_test');

exports.run = function(cl) {
    console.log('> ' + cl);
    var rc = exec(cl).code;
    if (rc !== 0) {
        echo('Exec failed with rc ' + rc);
        exit(rc);
    }
}
var run = exports.run;

exports.getExternals = function () {
    if (process.env['TF_BUILD']) {
        // skip adding node 5.10.1 to the PATH. the CI definition tests against node 5 and 6.
        return;
    }

    // determine the platform
    var platform = os.platform();
    if (platform != 'darwin' && platform != 'linux' && platform != 'win32') {
        throw new Error('Unexpected platform: ' + platform);
    }

    // download the same version of node used by the agent
    // and add node to the PATH
    var nodeUrl = 'https://nodejs.org/dist';
    var nodeVersion = 'v5.10.1';
    switch (platform) {
        case 'darwin':
            var nodeArchivePath = downloadArchive(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-darwin-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-darwin-x64', 'bin'));
            break;
        case 'linux':
            var nodeArchivePath = downloadArchive(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-linux-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-linux-x64', 'bin'));
            break;
        case 'win32':
            var nodeExePath = downloadFile(nodeUrl + '/' + nodeVersion + '/win-x64/node.exe');
            var nodeLibPath = downloadFile(nodeUrl + '/' + nodeVersion + '/win-x64/node.lib');
            var nodeDirectory = path.join(testPath, 'node');
            mkdir('-p', nodeDirectory);
            cp(nodeExePath, path.join(nodeDirectory, 'node.exe'));
            cp(nodeLibPath, path.join(nodeDirectory, 'node.lib'));
            addPath(nodeDirectory);
            break;
    }
}

var downloadFile = function (url) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // short-circuit if already downloaded
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'file', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!test('-f', marker)) {
        console.log('Downloading file: ' + url);

        // delete any previous partial attempt
        if (test('-f', targetPath)) {
            rm('-f', targetPath);
        }

        // download the file
        mkdir('-p', path.join(downloadPath, 'file'));
        var result = syncRequest('GET', url);
        fs.writeFileSync(targetPath, result.getBody());

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}

var downloadArchive = function (url) {
    // validate platform
    var platform = os.platform();
    if (platform != 'darwin' && platform != 'linux') {
        throw new Error('Unexpected platform: ' + platform);
    }

    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    if (!url.match(/\.tar\.gz$/)) {
        throw new Error('Expected .tar.gz');
    }

    // short-circuit if already downloaded and extracted
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'archive', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!test('-f', marker)) {
        // download the archive
        var archivePath = downloadFile(url);
        console.log('Extracting archive: ' + url);

        // delete any previously attempted extraction directory
        if (test('-d', targetPath)) {
            rm('-rf', targetPath);
        }

        // extract
        mkdir('-p', targetPath);
        var cwd = process.cwd();
        process.chdir(targetPath);
        try {
            run('tar -xzf "' + archivePath + '"');
        }
        finally {
            process.chdir(cwd);
        }

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}

var addPath = function (directory) {
    var separator;
    if (os.platform() == 'win32') {
        separator = ';';
    }
    else {
        separator = ':';
    }

    var existing = process.env['PATH'];
    if (existing) {
        process.env['PATH'] = directory + separator + existing;
    }
    else {
        process.env['PATH'] = directory;
    }
}
exports.addPath = addPath;