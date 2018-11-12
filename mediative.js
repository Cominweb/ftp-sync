var Request = require('request'),
    _ = require('underscore'),
    Colors = require('colors'),
    Util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Uniqid = require('./uniqid'),
    QString = require('query-string'),
    streamifier = require('streamifier'),
    Fs = require('fs');

var Mediative = function (settings) {
    var self = this;
    this.token = null;
    this.settings = settings;

    // function to log into the Chyro API
    this.auth = function (id) {
        // check settings
        if (!this.settings.mt_host || _.isEmpty(this.settings.mt_host))
            throw 'Please provide a host to log in the Mediative API';
        if (!this.settings.mt_key || _.isEmpty(this.settings.mt_key))
            throw 'Please provide the secret key needed to log in the Mediative API';
        if (!this.settings.mt_pub || _.isEmpty(this.settings.mt_pub))
            throw 'Please provide the public key needed to log in the Mediative API';
        if (!this.settings.mt_api || _.isEmpty(this.settings.mt_api))
            throw 'Please provide hostname of the API server for logging into the Mediative';

        // manage options
        var options = {
            url: "https://" + this.settings.mt_api + "/api/login.json?domain=" + this.settings.mt_host,
            auth: { user: settings.mt_pub, pass: settings.mt_key },
            headers: { 
                'X-Requested-With': 'MediativeApi', 
                'X-Requested-Version': '1.1',
                'Accept': 'application/json'
             },
            method: 'POST',
        };

        // then login to get token
        Request(options, function (err, res, body) {
            if (!err && res.statusCode == 200) {
                try {
                    var response = JSON.parse(body);
                } catch (e) {
                    console.error(self.settings.now() + '[Mediative] Unable to parse JSON response while logging into Mediative API. More details follows.'.red);
                    console.error(self.settings.now(), Util.inspect(e));
                }
                if (response.auth && response.auth.token) {
                    self.token = response.auth.token;
                    // token is an object width the following keys: domain, created, token, expires (date string), expiresTime (timestamp)
                    self.emit('auth' + id, response.auth.token);
                    self.emit('auth', response.auth.token);
                } else {
                    console.error(self.settings.now() + '[Mediative] Cannot log into the Mediative API ! No token found. Response body follows.'.red);
                    console.error(self.settings.now(), Util.inspect(response));
                }
            } else {
                console.error(self.settings.now() + '[Mediative] Error while logging in Mediative API. More details follows.'.red);
                console.error(self.settings.now(), Util.inspect(err));
                console.error(self.settings.now(), Util.inspect(options));
                console.error(self.settings.now(), Util.inspect(body));
            }
        });
    };


    this.post = function (ressource, datas, cb, errcb) {
        if (_.isEmpty(this.token)) {
            console.warn(self.settings.now() + '[Mediative] Mediative API not logged in. Logging in before fetching datas...'.yellow);
            var uid = Uniqid();
            self.once('auth' + uid, self.post.bind(self, ressource, datas, cb, errcb));
            self.auth(uid);
            return;
        }
        // manage options
        var options = {
            url: "https://" + this.settings.mt_host + "/" + ressource + ".json?d=" + this.settings.mt_host + "&token=" + this.token.token,
            headers: { 
                'X-Requested-With': 'MediativeApi', 
                'X-Requested-Version': '1.1',
                'Accept': 'application/json'
             },
            form: datas,
            method: 'POST',
        };
        // make request
        Request(options, function (err, res, body) {
            if (!err) {
                try {
                    var response = JSON.parse(body);
                } catch (e) {
                    console.error(self.settings.now() + '[Mediative] Unable to parse Mediative JSON response. More details follows.'.red);
                    console.error(self.settings.now(), Util.inspect(options));
                    console.error(self.settings.now(), Util.inspect(e));
                    if (_.isFunction(errcb)) errcb.call(self, e, options);
                }
                if (_.isObject(response)) {
                    if (res.statusCode == 200) {
                        if (_.isFunction(cb)) cb(response);
                    } else {
                        console.error(self.settings.now() + '[Mediative] Error while requesting the Mediative API, response code is not 200. More details follows.'.red);
                        console.error(self.settings.now(), Util.inspect(response));
                        console.error(self.settings.now(), Util.inspect(datas));
                        if (_.isFunction(errcb)) errcb.call(self, err, options);
                    }
                }
            } else {
                console.error(self.settings.now() + '[Mediative] Error while requesting the Mediative API. More details follows.'.red);
                console.error(self.settings.now(), Util.inspect(options));
                console.error(self.settings.now(), Util.inspect(err));
                console.error(self.settings.now(), Util.inspect(res));
                if (_.isFunction(errcb)) errcb.call(self, err, options);
            }
        });
    };

    this.get = function (ressource, datas, cb, errcb) {
        if (_.isEmpty(this.token)) {
            console.warn(self.settings.now() + '[Mediative] Mediative API not logged in. Logging in before fetching datas...'.yellow);
            var uid = Uniqid();
            self.once('auth' + uid, self.post.bind(self, ressource, datas, cb, errcb));
            self.auth(uid);
            return;
        }

        if (!_.isObject(datas)) datas = {};
        datas.d = this.settings.mt_host;
        datas.token = this.token.token;

        // manage options
        var options = {
            url: "https://" + this.settings.mt_host + "/" + ressource + ".json?" + QString.stringify(datas),
            headers: { 
                'X-Requested-With': 'MediativeApi', 
                'X-Requested-Version': '1.1',
                'Accept': 'application/json'
             },
            method: 'GET',
        };

        // make request
        Request(options, function (err, res, body) {
            if (!err) {
                try {
                    var response = JSON.parse(body);
                } catch (e) {
                    console.error(self.settings.now() + '[Mediative] Unable to parse Mediative JSON response. More details follows.'.red);
                    console.error(self.settings.now(), Util.inspect(options));
                    console.error(self.settings.now(), Util.inspect(e));
                    if (_.isFunction(errcb)) errcb.call(self, e, options);
                }
                if (_.isObject(response)) {
                    if (res.statusCode == 200) {
                        if (_.isFunction(cb)) cb(response);
                    } else {
                        console.error(self.settings.now() + '[Mediative] Error while getting the Mediative API, response code is not 200. More details follows.'.red);
                        console.error(self.settings.now(), Util.inspect(response));
                    }
                }
            } else {
                console.error(self.settings.now() + '[Mediative] Error while getting the Mediative API. More details follows.'.red);
                console.error(self.settings.now(), Util.inspect(options));
                console.error(self.settings.now(), Util.inspect(err));
                console.error(self.settings.now(), Util.inspect(res));
                if (_.isFunction(errcb)) errcb.call(self, err, options);
            }
        });
    };

    // make refresh requests
    this.renewToken = function () {
        var options = {
            url: "https://" + this.settings.mt_api + "/api/refresh/" + this.token.token + ".json?domain=" + this.settings.mt_host,
            auth: { user: settings.mt_pub, pass: settings.mt_key },
            headers: { 
                'X-Requested-With': 'MediativeApi', 
                'X-Requested-Version': '1.1',
                'Accept': 'application/json'
             },
        };
        console.info(self.settings.now() + '[Mediative] Automatic token refreshing...'.cyan);
        Request.get(options, function (error, response, body) {
            try {
                var json = JSON.parse(body);
                if (!_.isEmpty(json.token)) {
                    if (json.expiresTime) { // else, it can cause a forever loop
                        self.token = json;
                        console.log(self.settings.now() + ('[Mediative] Automatic token refreshed to ' + json.token).green);
                        self.setRenewer();
                    } else {
                        console.log(self.settings.now() + ('[Mediative] Error while refreshing token. No expiresTime found.').red);
                        console.log(Util.inspect(json));
                        self.token = null;
                    }
                } else {
                    throw 'The returned token is empty !';
                }
            } catch (e) {
                console.error(self.settings.now() + '[Mediative] Unable to parse JSON response while refreshing token. Details follows.'.red);
                console.error(self.settings.now(), Util.inspect(e));
            }
        });
    };


    // upload a file by chunk
    this.upload = function (fileInfos, callback, errcb) {
        var self = this;
        var filePath = fileInfos.filepath;
        var CHUNK_SIZE = 1 * 1024 * 1024, // 5MB
            buffer = Buffer.alloc(CHUNK_SIZE),
            chunkNumber = 0;
        var fileSize = Fs.statSync(filePath).size;
        Fs.open(filePath, 'r', function (err, fd) {
            if (err) throw err;
            function readNextChunk(id) {
                Fs.read(fd, buffer, 0, CHUNK_SIZE, null, function (err, bytesRead, buffer) {
                    if (err) throw err;
                    if (bytesRead === 0) {
                        // done reading file, do any necessary finalization steps
                        Fs.close(fd, function (err) {
                            if (err) throw err;
                        });
                        callback(id);
                        return;
                    }

                    var data;
                    if (bytesRead < CHUNK_SIZE) {
                        data = buffer.slice(0, bytesRead);
                    } else {
                        data = buffer;
                    }

                    // do something with `data`, then call `readNextChunk();`
                    // manage options
                    var options = {
                        url: "https://" + self.settings.mt_host + "/uploads/chunk.json?d=" + self.settings.mt_host + "&token=" + self.token.token,
                        headers: {
                            'X-Requested-With': 'MediativeApi',
                            'X-Requested-Version': '1.1',
                            'Accept': 'application/json',
                            'Content-Type': 'application/octet-stream',
                            'Content-Range': 'bytes ' + (chunkNumber * CHUNK_SIZE) + '-' + (chunkNumber * CHUNK_SIZE + bytesRead) + '/' + fileSize,
                        },
                        method: 'POST',
                    };
                    if (id) {
                        options.headers['Chunk'] = id;
                    } else {
                        options.headers['Original-Filename'] = fileInfos.base;
                    }
                    chunkNumber++;
                    streamifier.createReadStream(data).pipe(Request(options, function (err, res, body) {
                        if (!err) {
                            try {
                                var response = JSON.parse(body);
                            } catch (e) {
                                console.error(self.settings.now() + '[Mediative] Unable to parse Mediative JSON response. More details follows.'.red);
                                console.error(self.settings.now(), Util.inspect(options));
                                console.error(self.settings.now(), Util.inspect(body));
                                if (_.isFunction(errcb)) errcb.call(self, e, options);
                            }
                            if (_.isObject(response)) {
                                if (res.statusCode == 200) {
                                    if (response.id) {
                                        readNextChunk(response.id);
                                    } else {
                                        readNextChunk(response);
                                    }
                                } else {
                                    console.error(self.settings.now() + '[Mediative] Error while requesting the Mediative API, response code is not 200. More details follows.'.red);
                                    console.error(self.settings.now(), Util.inspect(response));
                                    console.error(self.settings.now(), Util.inspect(options));
                                    if (_.isFunction(errcb)) errcb.call(self, err, options);
                                }
                            }
                        } else {
                            console.error(self.settings.now() + '[Mediative] Error while requesting the Mediative API. More details follows.'.red);
                            console.error(self.settings.now(), Util.inspect(options));
                            console.error(self.settings.now(), Util.inspect(err));
                            console.error(self.settings.now(), Util.inspect(res));
                            if (_.isFunction(errcb)) errcb.call(self, err, options);
                        }
                    }))
                });
            }
            readNextChunk();
        });
    }
};

// extend the EventEmitter class using our Chyro class
Util.inherits(Mediative, EventEmitter);
module.exports = Mediative;