var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var merge = require('merge2');
var del = require('del');
var mocha = require('gulp-mocha');
var gts = require('gulp-typescript')
var typescript = require('typescript');
var dtsgen = require('dts-generator');

var proj = gts.createProject('./tsconfig.json', { typescript: typescript });
var ts = gts(proj);

var buildRoot = path.join(__dirname, '_build');
var libDest = path.join(buildRoot, 'lib');
var testDest = path.join(buildRoot, 'test');

gulp.task('clean', function (done) {
	del([buildRoot], done);
});

gulp.task('copy', ['clean'], function () {
	return gulp.src(['package.json', '../README.md'])
		.pipe(gulp.dest(buildRoot));
});

gulp.task('definitions', ['copy'], function () {
    return dtsgen.generate({
        name: 'vso-task-lib',
        baseDir: 'lib',
        files: [ 'vsotask.ts', 'taskcommand.ts', 'toolrunner.ts' ],
        externs: ['../definitions/node.d.ts', '../definitions/Q.d.ts'],
        out: '_build/d.ts/vso-task-lib.d.ts'
    });
});

gulp.task('build', ['definitions'], function () {
	var c = gulp.src(['./lib/*.ts', './test/*.ts'], { base: '.'})
		.pipe(ts)
		.pipe(gulp.dest(buildRoot));

	return c.dts;
});

gulp.task('default', ['build']);

gulp.task('testprep', function () {
	return gulp.src(['test/scripts/*.js'])
		.pipe(gulp.dest(path.join(testDest, 'scripts')));
});

gulp.task('test', ['testprep'], function () {
	var suitePath = path.join(testDest, 'tasklib.js');

	return gulp.src([suitePath])
		.pipe(mocha({ reporter: 'spec', ui: 'bdd'}));
});

