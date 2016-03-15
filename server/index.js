'use strict';

const express = require('express');
const ftwebservice = require('express-ftwebservice');
const authS3O = require('s3o-middleware');
const assertEnv = require('@quarterto/assert-env');
const logger = require('morgan');
const path = require('path');
const bodyParser = require('body-parser');
const noCache = require('./lib/nocache');
const uuidRegex = require('./lib/uuid');

const port = process.env.PORT || 6247;
const app = express();

const feedController = require('./controllers/feed.js');
const indexController = require('./controllers/index.js');
const viewArticleController = require('./controllers/viewArticle.js');
const uuidParam = `:uuid(${uuidRegex.raw})`;

assertEnv([
	'AWS_ACCESS_KEY',
	'AWS_SECRET_ACCESS_KEY',
	'ELASTIC_SEARCH_DOMAIN',
]);

if(app.get('env') !== 'development') {
	assertEnv([
		'HTTP_AUTH_PASS',
	]);
}

ftwebservice(app, require('./controllers/ftWebService'));


app.use(logger(process.env.LOG_FORMAT || (app.get('env') === 'development' ? 'dev' : 'combined')));
app.use(express.static(path.resolve(process.cwd(), 'resources/public')));
app.use(bodyParser.urlencoded({extended: true}));


// Routes which don't require Staff Single Sign-On
app.route('/feed').get(noCache).get(feedController);


// Add Staff Single Sign-On middleware
if(app.get('env') !== 'development') {
	app.use(authS3O);
}

// Routes which require Staff Single Sign-On
app.route('/').get(noCache).get(indexController);
app.route(`^/${uuidParam}$`).post(noCache).post(viewArticleController);
app.route(`^/${uuidParam}$`).get(noCache).get(indexController);


app.listen(port, () => console.log('Up and running on port', port));
