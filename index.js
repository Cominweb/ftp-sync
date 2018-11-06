var exec = require('child_process').exec;

var Chokidar = require('chokidar'),
    Path = require('path'),
    Util = require('util'),
    Fs = require('fs-ext'),
    Colors = require('colors'), // a bit of fun :)
    Moment = require('moment'),
    Args = require('optimist').argv,
    _ = require('underscore'),
    queue = require('queue'),
    touch = require("touch");

require('dotenv').config(); // load .env file


// There are default settings
var settings = {
    source: process.env.WATCH_IN,
    mt_api: process.env.MEDIATIVE_API,
    mt_host: process.env.MEDIATIVE_HOST,
    mt_key: process.env.MEDIATIVE_PRIVATE,
    mt_pub: process.env.MEDIATIVE_PUBLIC,
    now: function () {
        // used to display current date in console logs
        return ('[' + Moment().format('YYYY-MM-DD HH:mm:ss') + '] ').grey;
    },
    verbose: process.env.VERBOSE,
};
_.extend(settings, Args);
if (settings.v) settings.verbose = settings.v;

// init Apis
var mediativeapi = require('./mediative');
var Mediative = new mediativeapi(settings);
var q = queue({ concurrency: 1, timeout: 3600 * 1000 });

var pjson = require('./package.json');

// welcome msg
console.log('            ======================================================');
console.log('            =               Mediative synchronizer               ='.blue.bold);
console.log('            =                   ' + 'Version ' + pjson.version.bold + '                   =');
console.log('            ======================================================');
if (settings.verbose) {
    console.info(settings.now() + '[Info] Verbose mode is On'.cyan.bold);
}

// manage help
if (settings.h || settings.help) {
    console.log('======================================================');
    console.log('');
    console.log('Available options: '.green);
    console.log('');
    console.log('--source'.cyan)
    console.log('  Define the source directory where the script should watch for new files');
    console.log('');
    console.log('--mt_api'.cyan);
    console.log('  Define the host or IP adress of the Mediative API server (default: api.omi.tv)');
    console.log('');
    console.log('--mt_host'.cyan);
    console.log('  Define the host or IP adress where to log in the Mediative API');
    console.log('');
    console.log('--mt_pub'.cyan);
    console.log('  Define public key used to log in the Mediative API');
    console.log('');
    console.log('--mt_key'.cyan);
    console.log('  Define private key used to log in the Mediative API');
    console.log('');
    console.log('--verbose [-v]'.cyan);
    console.log('  Use verbose mode');
    console.log('');
    console.log('======================================================');
    console.log('');
    console.log('Examples :'.green);
    console.log('');
    console.log('node index.js --mt_host beta.omi.tv --mt-key aaabbbccc333 --mt_pub 1234567890');
    console.log('');
    console.log('node index.js -v --source /home/ftp/myuser/drop');
    console.log('');
    console.log('======================================================');
    console.log('');
    console.log('Infos & license :'.green);
    console.log('');
    console.log('All parameters are optionals. Contact support@cominweb.com for more infos.');
    console.log('(c) Cominweb 2018'.gray);
    process.exit(0); // and then exit :)
}

// Chokidar will watch our 'ftp' dir for changes
var watcher = Chokidar.watch(settings.source, {
    ignored: /[\/\\]\./, // ignore file which begins whith a dot
    persistent: true, // we want it to act as a stand-alone server
    usePolling: true,
    interval: 500,
    binaryInterval: 1000,
    ignoreInitial: false // we do not want the initial files to be trated as added
});


// fn used to put datas on Mediative API
var processing = {};
function upload(pathInfo) {
    // the file is already being processed?
    if (!_.isUndefined(processing[pathInfo.filepath])) {
        return;
    }
    processing[pathInfo.filepath] = true;
    if (settings.verbose) {
        console.info(settings.now() + '[Info] Datas upload on Mediative API started for file '.cyan, pathInfo.base.cyan);
    }
    // let's auth on Mediative
    Mediative.auth(pathInfo.base);
    Mediative.once('auth' + pathInfo.base, function () {
        Mediative.upload(pathInfo, function (response) {
            var local_datas = {
                filenames: [response.filename]
            };

            var upload = response.response.uploads[0].Upload;
            var mt_datas = {
                type: 'LocalVideo',
                license: 'copyright',
                settings: JSON.stringify({}),
                local_datas: JSON.stringify(local_datas),
                distant_datas: JSON.stringify({}),
                thumbnails: JSON.stringify({}),
                tags: '',
                approved: false,
                title: upload.title,
                description: upload.title,
                Upload: {id: upload.id},
            };

            if (settings.verbose) {
                console.info(settings.now() + '[Info] Sending Mediative datas... '.cyan);
            }

            Mediative.post('medias', mt_datas, function (media_datas) {
                // let's check if POST has been successfull
                if (settings.verbose) {
                    console.info(settings.now() + '[Info] Datas sent to Mediative successfully.'.green);
                }
                // var mid = media_datas.response.medias[0].Media.id;
                // and now remove file
                Fs.unlink(pathInfo.dir + Path.sep + pathInfo.base, function(err){
                    if(err) {
                        console.error(this.settings.now() + '[Error] An error occured while trying to remove the source file. More details follow.'.red);
                        console.error(Util.inspect(err));
                    } else if (settings.verbose) {
                        console.info(settings.now() + '[Info] File cleaned successfully.'.green);
                    }
                });
            }, function (err, options) { // error :(
                console.error(this.settings.now() + '[Error] Error happened while saving media on Mediative. More details follows.'.red);
                console.error(Util.inspect(options));
                console.error(Util.inspect(err));
                console.error(Util.inspect(mt_datas));
                // clean things
                delete processing[pathInfo.filepath];
            });

        });
    });
}

var watchedFiles = [], watchTime = {}, global = this;
// let's set our events
watcher.on('error', function (error) {
    console.error(settings.now() + '[Error] Error happened'.red, error);
}).on('ready', function () {
    // watcher is ready !
    if (settings.verbose) {
        console.info(settings.now() + '[Info] Initial scan complete. Ready for changes.'.cyan);
    }
    Fs.readdir(settings.source, function(err, files) {
        if(!err) {
            files.forEach(function(filename) {
                touch(settings.source + Path.sep + filename, {nocreate: true});
            });
        } else {
            console.error(settings.now() + '[Error] Cannot read source directory content for initial launch. Please check read permissions.')
        }
    });
}).on('raw', function (event, path, details) {
    // raw event is triggered on each event
    // a raw event is triggered when a file is created, when the datas comes into it, and when the data stop writing
    // so let's detect the last one, which is the more usefull to us
    var basename = Path.basename(path), ext = Path.extname(path);
    if (basename != Path.basename(settings.source) && !_.contains(watchedFiles, path) && !_.isEmpty(ext)) {
        // the raw change event is triggered with the 'ftp' path when it concerns a file creation
        try {
            // the raw change event is triggered a first time, when the file begin to be written. It's also triggered when a file is deleted
            // so we check if the file can be opened (if there's an error, the file may be locked or deleted)
            var nRetries = 100; // 100 tries
            var retryTimeInterval = 36000; // 36 sec
            var currentRetry = 0; // = 60 min
            var pollFunction = function (nRetries, currentRetry, retryTimeInterval, path, settings) {
                try {
                    if (settings.verbose) {
                        console.log(settings.now() + ('[Info] Trying to access a file (' + currentRetry + '/' + nRetries + ')...').cyan);
                    }
                    // let's compare date updates
                    var stat = Fs.statSync(path);
                    if (_.isUndefined(watchTime[path])) {
                        watchTime[path] = stat.mtime;
                        if (settings.verbose) {
                            console.log(settings.now() + ('[Info] Watching a new file (' + basename + ').').green);
                        }
                        throw 'New file watch';
                    } else {
                        var previousTime = Moment(watchTime[path]),
                            currentTime = Moment(stat.mtime);
                        if (previousTime.isBefore(currentTime)) {
                            watchTime[path] = stat.mtime;
                            if (settings.verbose) {
                                console.log(settings.now() + ('[Info] The file ' + basename + ' is being written.').green);
                            }
                            throw 'File being written';
                        } else {
                            delete watchTime[path];
                        }
                    }
                    // do stuff with file here
                    if (settings.verbose) {
                        console.log(settings.now() + '[Info] File is ready to be treated.'.green);
                    }
                    var pathInfo = Path.parse(path);
                    pathInfo.filepath = path; // shortcut used in logs :)
                    q.push(function (cb) {
                        upload(pathInfo, cb);
                    });
                    q.start();
                } catch (e) {
                    if (e.code && e.code == 'ENOENT') { // file has been deleted
                        if (settings.verbose) {
                            console.log(settings.now() + '[Info] File has been deleted.'.green);
                        }
                        var i = watchedFiles.indexOf(path);
                        watchedFiles.splice(i, 1);
                    } else {
                        if (currentRetry < nRetries) {
                            currentRetry++;
                            setTimeout(pollFunction.bind(global, nRetries, currentRetry, retryTimeInterval, path, settings), retryTimeInterval);
                        } else {
                            console.error(settings.now() + ('[Error] Cannot read the file ' + path + ' after 100 tries !').green);
                            var i = watchedFiles.indexOf(path);
                            watchedFiles.splice(i, 1);
                        }
                    }
                };
            };
            watchedFiles.push(path);
            pollFunction(nRetries, currentRetry, retryTimeInterval, path, settings);
        } catch (e) { // the file cannot be accessed, so it's probably deleted
            var i = watchedFiles.indexOf(path);
            watchedFiles.splice(i, 1);
            console.info(settings.now() + '[Info] File has been deleted.'.yellow);
        }
    }
});


// ending message :)
process.on('exit SIGTERM SIGINT', function (code) {
    console.info(settings.now() + '[Info] Exiting process, bye.'.cyan);
});
