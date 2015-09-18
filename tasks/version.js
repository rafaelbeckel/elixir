var fs = require('fs');
var del = require('del');
var glob = require('glob');
var gulp = require('gulp');
var rev = require('gulp-rev');
var Elixir = require('laravel-elixir');
var vinylPaths = require('vinyl-paths');
var parsePath  = require('parse-filepath');
var publicPath  = Elixir.config.publicPath;
var revReplace = require('gulp-rev-replace');


/*
 |----------------------------------------------------------------
 | Versioning / Cache Busting
 |----------------------------------------------------------------
 |
 | This task will append a small hash on the end of your file
 | and generate a manifest file which contains the current
 | "version" of the filename for the application to use.
 |
 */

Elixir.extend('version', function(src, buildPath, assets) {
    var paths = prepGulpPaths(src, buildPath);
    var assets = prepGulpPaths(assets, buildPath);

    new Elixir.Task('version', function() {
        var files = vinylPaths();
        var manifest = paths.output.baseDir + '/rev-manifest.json';

        this.log(paths.src, paths.output);

        emptyBuildPathFiles(paths.output.baseDir, manifest);

        // We need to remove the publicPath from the output base to get the
        // correct prefix path.
        var filePathPrefix = paths.output.baseDir.replace(publicPath, '') + '/';

        return (
            gulp.src(paths.src.path, { base: './' + publicPath })
            .pipe(gulp.dest(paths.output.baseDir))
            .pipe(files)
            .pipe(rev())
            .pipe(revReplace({prefix: filePathPrefix}))
            .pipe(gulp.dest(paths.output.baseDir))
            .pipe(rev.manifest())
            .pipe(gulp.dest(paths.output.baseDir))
            .on('end', function() {
                // We'll get rid of the duplicated file that
                // usually gets put in the "build" folder,
                // alongside the suffixed version.
                del(files.paths, { force: true });

                // We'll copy over relevant sourcemap files.
                copyMaps(paths.src.path, paths.output.baseDir);

                // We'll also copy the assets if they exist.
                copyAssets(assets.src.path, assets.output.baseDir);
            })
        );
    })
    .watch(paths.src.path);
});


/**
 * Prep the Gulp src and output paths.
 *
 * @param  {string|array} src
 * @param  {string|null}  buildPath
 * @return {object}
 */
var prepGulpPaths = function(src, buildPath) {
    src = Array.isArray(src) ? src : [src];

    return new Elixir.GulpPaths()
        .src(src, config.publicPath)
        .output(buildPath || config.get('public.versioning.buildFolder'));
};


/**
 * Empty all relevant files from the build directory.
 *
 * @param  {string} buildPath
 * @param  {string} manifest
 */
var emptyBuildPathFiles = function(buildPath, manifest) {
    fs.stat(manifest, function(err, stat) {
        if (! err) {
            manifest = JSON.parse(fs.readFileSync(manifest));

            for (var key in manifest) {
                del.sync(buildPath + '/' + manifest[key], { force: true });
            }
        }
    });
};


/**
 * Copy source maps to the build directory.
 *
 * @param  {array} src
 * @param  {string} buildPath
 */
var copyMaps = function(src, buildPath) {
    getFiles(src,function(files){
        var maps = files
                    .map(function(file) {
                        return file + '.map';
                    })
                    .filter(function(file) {
                        return fs.existsSync(file);
                    });

        copyFiles(maps, buildPath);
    });
};


/**
 * Copy user assets to the build directory.
 *
 * @param  {array} src
 * @param  {string} buildPath
 */
var copyAssets = function(src, buildPath) {
    getFiles(src,function(files){
        copyFiles(files, buildPath);
    });
};


/**
 * Extract the file listing from an array that may
 * contain files, directories and wildcard strings
 *
 * @param  {array} src
 * @return ({array})
 */
var getFiles = function(src,callback) {
    src.forEach(function(file) {
        glob(file, {}, function(error, files) {
            if (error) return;
            callback(files);
        });
    });
}


/**
 * Copy files from public path to build path.
 *
 * @param  {array} files
 * @param  {string} buildPath
 */
var copyFiles = function(files, buildPath) {
    files.forEach(function(file) {
        var dest = file.replace(publicPath, buildPath);
        gulp.src(file).pipe(gulp.dest(parsePath(dest).dirname));
    });
}
