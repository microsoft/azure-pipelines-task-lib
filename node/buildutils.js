
require('shelljs');
var fs = require('fs');
var os = require('os');
var path = require('path');
var process = require('process');
var admZip = require('adm-zip');
var deasync = require('deasync')
const Downloader = require("nodejs-file-downloader");

var downloadPath = path.join(__dirname, '_download');
var testPath = path.join(__dirname, '_test');

exports.run = function (cl) {
    console.log('> ' + cl);
    var rc = exec(cl).code;
    if (rc !== 0) {
        echo('Exec failed with rc ' + rc);
        exit(rc);
    }
}
var run = exports.run;



const getExternalsAsync = async () => {
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
    var nodeUrl = process.env['TASK_NODE_URL'] || 'https://nodejs.org/dist';
    nodeUrl = nodeUrl.replace(/\/$/, '');  // ensure there is no trailing slash on the base URL
    var nodeVersion = 'v16.13.0';
    switch (platform) {
        case 'darwin':
            var nodeArchivePath = await downloadArchiveAsync(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-darwin-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-darwin-x64', 'bin'));
            break;
        case 'linux':
            var nodeArchivePath = await downloadArchiveAsync(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-linux-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-linux-x64', 'bin'));
            break;
        case 'win32':
            var nodeExePath = await downloadFileAsync(nodeUrl + '/' + nodeVersion + '/win-x64/node.exe');
            var nodeLibPath = await downloadFileAsync(nodeUrl + '/' + nodeVersion + '/win-x64/node.lib');
            var nodeDirectory = path.join(testPath, 'node');
            mkdir('-p', nodeDirectory);
            cp(nodeExePath, path.join(nodeDirectory, 'node.exe'));
            cp(nodeLibPath, path.join(nodeDirectory, 'node.lib'));
            addPath(nodeDirectory);
            break;
    }
}

exports.getExternalsAsync = getExternalsAsync



/**
 * @deprecated This method uses library which is not prefered to use on production
 */

exports.getExternals = function () {
    var result = false;
    getExternalsAsync().then(t => result = true);
    deasync.loopWhile(function () { return !result });
    return result;
}


var downloadFileAsync = async function (url, fileName) {
    return new Promise(async (resolve, reject) => {
        // validate parameters
        if (!url) {
            reject(new Error('Parameter "url" must be set.'));
        }

        // skip if already downloaded
        var scrubbedUrl = url.replace(/[/\:?]/g, '_');
        if (fileName == undefined)
            fileName = scrubbedUrl
        var targetPath = path.join(downloadPath, 'file', fileName);
        var marker = targetPath + '.completed';
        if (test('-f', marker)) {
            console.log('File already exist: ' + targetPath);
            resolve(targetPath)
            return;
        }

        console.log('Downloading file: ' + url);
        // delete any previous partial attempt
        if (test('-f', targetPath)) {
            rm('-f', targetPath);
        }

        // download the file
        mkdir('-p', path.join(downloadPath, 'file'));

        const downloader = new Downloader({
            url: url,
            directory: path.join(downloadPath, 'file'),
            fileName: fileName
        });

        try {
            const { fileName } = await downloader.download(); //Downloader.download() resolves with some useful properties.
            fs.writeFileSync(marker, '');
            resolve(fileName)
        } catch (error) {
            reject(error)
        }
    });
}


var downloadArchiveAsync = async function (url, fileName) {
    return new Promise(async (resolve, reject) => {
        if (!url) {
            reject(new Error('Parameter "url" must be set.'))
            return
        }

        // skip if already downloaded and extracted
        var scrubbedUrl = url.replace(/[\/\\:?]/g, '_');
        if (fileName != undefined)
            scrubbedUrl = fileName
        var targetPath = path.join(downloadPath, 'archive', scrubbedUrl);
        var marker = targetPath + '.completed';
        if (test('-f', marker)) {
            resolve(targetPath)
            return
        }
        // download the archive
        var archivePath = await downloadFileAsync(url, scrubbedUrl);
        console.log('Extracting archive: ' + url);

        // delete any previously attempted extraction directory
        if (test('-d', targetPath)) {
            rm('-rf', targetPath);
        }

        // extract
        mkdir('-p', targetPath);
        var zip = new admZip(archivePath);
        zip.extractAllTo(targetPath);

        // write the completed marker
        fs.writeFileSync(marker, '');
        resolve(targetPath);
    })
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