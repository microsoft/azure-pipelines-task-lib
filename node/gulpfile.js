var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var merge = require('merge2');
var del = require('del');
var mocha = require('gulp-mocha');
var gts = require('gulp-typescript')
var typescript = require('typescript');
var dtsgen = require('dts-generator');
var semver = require('semver');
var spawn = require('child_process').spawn;
var shell = require('shelljs');

var proj = gts.createProject('./tsconfig.json', { typescript: typescript });
var ts = gts(proj);

var buildRoot = path.join(__dirname, '_build');
var testDest = path.join(buildRoot, 'test');

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
    var lib = require('./lib.json');
    var strPath = path.join('Strings', 'resources.resjson', 'en-US');
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
	return gulp.src(['package.json', 'lib.json', path.join('**', 'resources.resjson'), path.join('..', 'LICENSE'), path.join('..', 'README.md')])
		.pipe(gulp.dest(buildRoot))
});

gulp.task('copy:d.ts', ['clean'], function () {
	return gulp.src(['definitions/**/*'])
		.pipe(gulp.dest(path.join(buildRoot, 'definitions')))
});

gulp.task('definitions', ['copy:d.ts', 'copy:manifest'], function () {
    return dtsgen.generate({
        name: 'vsts-task-lib',
        baseDir: 'lib',
        files: [ 'task.ts', 'taskcommand.ts', 'toolrunner.ts' ],
		excludes: ['node_modules/**/*.d.ts', 'definitions/**/*.d.ts'],
        externs: ['../definitions/node.d.ts', '../definitions/Q.d.ts'],
        out: '_build/d.ts/vsts-task-lib.d.ts'
    });
});

gulp.task('build:lib', ['definitions'], function () {
	return gulp.src(['./lib/*.ts'], { base: './lib'})
		.pipe(ts)
        .on('error', errorHandler)
		.pipe(gulp.dest(buildRoot))
});

gulp.task('default', ['build:lib']);

//---------------------------------------------------------------
// gulp test
//---------------------------------------------------------------
gulp.task('build:test', function () {
    return gulp.src(['./test/*.ts'], { base: '.'})
        .pipe(ts)
        .on('error', errorHandler)
        .pipe(gulp.dest(buildRoot));
});

gulp.task('testprep:testsuite', ['build:test'], function () {
	return gulp.src(['test/scripts/*.js'])
		.pipe(gulp.dest(path.join(testDest, 'scripts')));
});

gulp.task('testprep:node_modules', ['testprep:testsuite'], function () {
	return gulp.src([(buildRoot + '/*.js'), 'lib.json'])
		.pipe(gulp.dest(path.join(testDest, 'node_modules/vsts-task-lib/')));
});

gulp.task('test', ['testprep:node_modules'], function () {
	var suitePath = path.join(testDest, 'tasklib.js');

	return gulp.src([suitePath])
		.pipe(mocha({ reporter: 'spec', ui: 'bdd'}));
});

//---------------------------------------------------------------
// gulp publish (to npm)
// You need npm user and creds configure on your box to run this
//---------------------------------------------------------------

gulp.task('prepublish', function (done) {
	return del([
		path.join(buildRoot, 'definitions'), 
		path.join(buildRoot, 'test'),
		path.join(buildRoot, 'd.ts')], 
		done);
});

gulp.task('publish', ['prepublish'], function (done) {
	shell.pushd(buildRoot);
	spawn('npm', ['publish'], { stdio: 'inherit' }).on('close', done);
	shell.popd();
});

