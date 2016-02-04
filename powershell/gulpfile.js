var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var del = require('del');
var minimist = require('minimist');
var semver = require('semver');
var tsc = require('gulp-tsc');
var mocha = require('gulp-mocha');
var spawn = require('child_process').spawn;
var shell = require('shelljs');
var mopts = {
    boolean: 'ci',
    string: 'suite',
    default: { ci: false, suite: '**' }
};
var options = minimist(process.argv.slice(2), mopts);
var buildRoot = path.join(__dirname, '_build');
var testRoot = path.join(buildRoot, 'Tests');
var testTemp = path.join(testRoot, 'Temp');
var MIN_NODE_VER = '4.0.0';
if (semver.lt(process.versions.node, MIN_NODE_VER)) {
    console.error('requires node >= ' + MIN_NODE_VER + '.  installed: ' + process.versions.node);
    process.exit(1);
}

function errorHandler(err) {
    process.exit(1);
}

//---------------------------------------------------------------
// gulp build
//---------------------------------------------------------------
gulp.task('clean', function (done) {
    return del([buildRoot], done);
});

gulp.task('loc:generate', ['clean'], function() {
    // Build the content for the en-US resjson file.
    var lib = require('./VstsTaskSdk/lib.json');
    var strPath = path.join('VstsTaskSdk', 'Strings', 'resources.resjson', 'en-US');
    shell.mkdir('-p', strPath);
    var strings = { };
    if (lib.messages) {
        for (var key in lib.messages) {
            var messageKey = 'loc.messages.' + key;
            strings[messageKey] = lib.messages[key];
        }
    }

    // Create the en-US resjson file.
    var enPath = path.join(strPath, 'resources.resjson');
    var enContents = JSON.stringify(strings, null, 2);
    fs.writeFileSync(enPath, enContents)
    return;
});

gulp.task('copy:manifest', ['loc:generate'], function () {
    return gulp.src(['package.json', path.join('..', 'LICENSE'), path.join('..', 'README.md')])
        .pipe(gulp.dest(buildRoot))
});

gulp.task('build:lib', ['copy:manifest'], function () {
    return gulp.src([path.join('VstsTaskSdk', '**' ,'*')])
        .pipe(gulp.dest(path.join(buildRoot, 'VstsTaskSdk')))
});

gulp.task('version:lib', ['build:lib'], function () {
    // Stamp the version number from the package.json onto the
    // PowerShell module definition.
    var targetPsd1 = path.join(buildRoot, 'VstsTaskSdk', 'VstsTaskSdk.psd1');
    var psd1Contents = fs.readFileSync(targetPsd1, 'ucs2'); // UCS-2 is a subset of UTF-16. UTF-16 is not supported by node.
    var token = "ModuleVersion = '0.1'";
    var tokenStart = psd1Contents.indexOf(token);
    if (tokenStart < 0) {
        console.error('ModuleVersion token not found in PSD1.');
        process.exit(1);
    }

    var packageJson = require('./package.json');
    psd1Contents = psd1Contents.substring(0, tokenStart) + "ModuleVersion = '" + packageJson.version + "'" + psd1Contents.substring(tokenStart + token.length);
    fs.writeFileSync(targetPsd1, psd1Contents, 'ucs2');
    return;
});

gulp.task('default', ['version:lib']);

//---------------------------------------------------------------
// gulp test
//---------------------------------------------------------------
gulp.task('clean:tests', function (cb) {
    return del([testRoot], cb);
});

gulp.task('compile:tests', ['clean:tests'], function (cb) {
    var testsPath = path.join(__dirname, 'Tests', '**/*.ts');
    return gulp.src([testsPath, 'definitions/*.d.ts'])
        .pipe(tsc())
        .pipe(gulp.dest(testRoot));
});

gulp.task('copy:tests', ['compile:tests'], function (cb) {
    return gulp.src(['Tests/**/*'])
        .pipe(gulp.dest(testRoot));
});

gulp.task('test', ['copy:tests'], function () {
    process.env['TASK_TEST_TEMP'] = testTemp;
    shell.rm('-rf', testTemp);
    shell.mkdir('-p', testTemp);
    var suitePath = path.join(testRoot, options.suite + '/_suite.js');
    console.info(suitePath);
    return gulp.src([suitePath])
        .pipe(mocha({ reporter: 'spec', ui: 'bdd', useColors: !options.ci }));
});

//---------------------------------------------------------------
// gulp publish (to npm)
// You need npm user and creds configure on your box to run this
//---------------------------------------------------------------

gulp.task('prepublish', function (done) {
    return del([
        path.join(buildRoot, 'test')],
        done);
});

gulp.task('publish', ['prepublish'], function (done) {
    shell.pushd(buildRoot);
    spawn('npm', ['publish'], { stdio: 'inherit' }).on('close', done);
    shell.popd();
});

