var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var del = require('del');
var mocha = require('gulp-mocha');
var typescript = require('gulp-tsc');

gulp.task('compile', function(){
  gulp.src(['src/**/*.ts'])
    .pipe(typescript())
    .pipe(gulp.dest('dest/'))
});

var buildRoot = path.join(__dirname, '_build');
var libDest = path.join(buildRoot, 'lib');
var testDest = path.join(buildRoot, 'test');

//var testRoot = path.join(buildRoot, 'test');

gulp.task('copy', ['clean'], function () {
	return gulp.src(['package.json', '../README.md'])
		.pipe(gulp.dest(buildRoot));
});

gulp.task('compileLib', ['clean'], function () {
	return gulp.src(['lib/*.ts'])
		.pipe(typescript({ declaration: true }))
		.pipe(gulp.dest(libDest));
});

gulp.task('compileTests', ['clean'], function () {
	return gulp.src(['test/*.ts'])
		.pipe(typescript({ declaration: false }))
		.pipe(gulp.dest(testDest));
});

gulp.task('build', ['clean', 'compileLib', 'compileTests', 'copy']);

gulp.task('testprep', ['clean'], function () {
	return gulp.src(['test/scripts/*.js'])
		.pipe(gulp.dest(path.join(testDest, 'scripts')));
});

gulp.task('test', ['build', 'testprep'], function () {
	var suitePath = path.join(testDest, 'tasklib.js');

	return gulp.src([suitePath])
		.pipe(mocha({ reporter: 'spec', ui: 'bdd'}));
});

gulp.task('clean', function (done) {
	del([buildRoot], done);
});

gulp.task('default', ['test']);
