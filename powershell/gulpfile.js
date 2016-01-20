var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var del = require('del');
var semver = require('semver');
var spawn = require('child_process').spawn;
var shell = require('shelljs');

var buildRoot = path.join(__dirname, '_build');

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


gulp.task('default', ['build:lib']);

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

