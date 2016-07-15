
require('shelljs/make');
var path = require('path');
var fs = require('fs');

var rp = function (relPath) {
    return path.join(__dirname, relPath);
}

var buildPath = path.join(__dirname, '_build');
var testPath = path.join(__dirname, '_test');

var run = function(cl) {
    console.log('> ' + cl);
    var rc = exec(cl).code;
    if (rc !== 0) {
        echo('Exec failed with rc ' + rc);
        exit(rc);
    }    
}

target.clean = function () {
    rm('-Rf', buildPath);
    rm('-Rf', testPath);
};

target.build = function() {
    target.clean();
    
    run('tsc --outDir ' + buildPath);
    cp(rp('dependencies/typings.json'), buildPath);    
    cp(rp('package.json'), buildPath);
    cp(rp('README.md'), buildPath);
    cp(rp('../LICENSE'), buildPath);
    cp(rp('lib.json'), buildPath);
    cp('-Rf', rp('Strings'), buildPath);
    // just a bootstrap file to avoid /// in final js and .d.ts file
    rm(path.join(buildPath, 'index.*'));

    target.loc();
}

target.test = function() {
    target.build();

    run('tsc --outDir ' + testPath + ' test/tasklib.ts');
    cp('-Rf', rp('test/scripts'), testPath);
    run('mocha ' + path.join(testPath, 'tasklib.js'));
}

target.loc = function() {
    var lib = require('./lib.json');
    var strPath = path.join('Strings', 'resources.resjson', 'en-US')
    mkdir('-p', strPath);
    var strings = { };
    if (lib.messages) {
        for (var key in lib.messages) {
            strings['loc.messages.' + key] = lib.messages[key];
        }
    }

    // Create the en-US resjson file.
    var enContents = JSON.stringify(strings, null, 2);
    fs.writeFileSync(path.join(strPath, 'resources.resjson'), enContents)
}