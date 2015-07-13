/**
 * This file is part of the Scribe jQuery Numeric script.
 *
 * For the full copyright and license information, view the LICENSE.md
 * file that was distributed with this source code.
 */

// Include require packages for the gulp tasks.
var gulp   = require('gulp'),
    jshint = require('gulp-jshint'),
    concat = require('gulp-concat'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps');

var DEST_PROD = 'dist/';

// Define our default task to run when gulp is called without arguments.
gulp.task('default', ['watch']);

// Define our default task to run when gulp is called without arguments.
gulp.task('build', ['jshint', 'build-js']);

// Configure the jshint (JS Linting) tasks.
gulp.task('jshint', function() {
    return gulp.src('src/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'));
});

// Automatic linting of files durng developmen, on-the-fly!
gulp.task('watch', function() {
    gulp.watch('src/*.js', ['jshint']);
});

// Build a release that that (optionally) includes minified and (always) unminified output.
gulp.task('build-js', function() {
    return gulp.src('src/*.js')
        .pipe(sourcemaps.init())
        .pipe(concat('jquery-constraint-numeric.js'))
        .pipe(gulp.dest(DEST_PROD))
        .pipe(gutil.env.type === 'production' ? uglify() : gutil.noop())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(DEST_PROD));
});

/* EOF */
