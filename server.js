'use strict';

var bodyParser = require('body-parser');
var express = require('express');
var mongoose = require('mongoose');

// Mongoose internally uses a promise-like object,
// but its better to make Mongoose use built in es6 promises
mongoose.Promise = global.Promise;

// config.js is where we control constants for entire
// app like PORT and DATABASE_URL

var _require = require('./config'),
    PORT = _require.PORT,
    DATABASE_URL = _require.DATABASE_URL;

var _require2 = require('./models'),
    Restaurant = _require2.Restaurant;

var app = express();
app.use(bodyParser.json());

// GET requests to /restaurants => return 10 restaurants
app.get('/restaurants', function (req, res) {
    Restaurant.find
    // we're limiting because restaurants db has > 25,000
    // documents, and that's too much to process/return
    ().limit(10
        // `exec` returns a promise
    ).exec
    // success callback: for each restaurant we got back, we'll
    // call the `.apiRepr` instance method we've created in
    // models.js in order to only expose the data we want the API return.
    ().then(function (restaurants) {
        res.json({
            restaurants: restaurants.map(function (restaurant) {
                return restaurant.apiRepr();
            })
        });
    }).catch(function (err) {
        console.error(err);
        res.status(500).json({
            message: 'Internal server error'
        });
    });
});

// can also request by ID
app.get('/restaurants/:id', function (req, res) {
    Restaurant
        // this is a convenience method Mongoose provides for searching
        // by the object _id property
        .findById(req.params.id).exec().then(function (restaurant) {
            return res.json(restaurant.apiRepr());
        }).catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Internal server error'
            });
        });
});

app.post('/restaurants', function (req, res) {

    var requiredFields = ['name', 'borough', 'cuisine'];
    for (var i = 0; i < requiredFields.length; i++) {
        var field = requiredFields[i];
        if (!(field in req.body)) {
            var message = 'Missing `' + field + '` in request body';
            console.error(message);
            return res.status(400).send(message);
        }
    }

    Restaurant.create({
        name: req.body.name,
        borough: req.body.borough,
        cuisine: req.body.cuisine,
        grades: req.body.grades,
        address: req.body.address
    }).then(function (restaurant) {
        return res.status(201).json(restaurant.apiRepr());
    }).catch(function (err) {
        console.error(err);
        res.status(500).json({
            message: 'Internal server error'
        });
    });
});

app.put('/restaurants/:id', function (req, res) {
    // ensure that the id in the request path and the one in request body match
    if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
        var message = 'Request path id (' + req.params.id + ') and request body id ' + ('(' + req.body.id + ') must match');
        console.error(message);
        res.status(400).json({
            message: message
        });
    }

    // we only support a subset of fields being updateable.
    // if the user sent over any of the updatableFields, we udpate those values
    // in document
    var toUpdate = {};
    var updateableFields = ['name', 'borough', 'cuisine', 'address'];

    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });

    Restaurant
        // all key/value pairs in toUpdate will be updated -- that's what `$set` does
        .findByIdAndUpdate(req.params.id, {
            $set: toUpdate
        }).exec().then(function (restaurant) {
            return res.status(204).end();
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Internal server error'
            });
        });
});

app.delete('/restaurants/:id', function (req, res) {
    Restaurant.findByIdAndRemove(req.params.id).exec().then(function (restaurant) {
        return res.status(204).end();
    }).catch(function (err) {
        return res.status(500).json({
            message: 'Internal server error'
        });
    });
});

// catch-all endpoint if client makes request to non-existent endpoint
app.use('*', function (req, res) {
    res.status(404).json({
        message: 'Not Found'
    });
});

// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
var server = void 0;

// this function connects to our database, then starts the server
function runServer() {
    var databaseUrl = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DATABASE_URL;
    var port = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : PORT;


    return new Promise(function (resolve, reject) {
        mongoose.connect(databaseUrl, function (err) {
            if (err) {
                return reject(err);
            }
            server = app.listen(port, function () {
                console.log('Your app is listening on port ' + port);
                resolve();
            }).on('error', function (err) {
                mongoose.disconnect();
                reject(err);
            });
        });
    });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
    return mongoose.disconnect().then(function () {
        return new Promise(function (resolve, reject) {
            console.log('Closing server');
            server.close(function (err) {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
    runServer().catch(function (err) {
        return console.error(err);
    });
};

module.exports = {
    app: app,
    runServer: runServer,
    closeServer: closeServer
};
