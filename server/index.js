'use strict';
const express = require('express');
const ftwebservice = require('express-ftwebservice');
const authS3O = require('s3o-middleware');
const assertEnv = require('@quarterto/assert-env');
const logger = require('morgan');
const path = require('path');

const port = process.env.PORT || 6247;
const app = express();


if(app.get('env') === 'development') {
	assertEnv([
	]);
} else {
	assertEnv([
		'HTTP_AUTH_PASS',
	]);
}

ftwebservice(app, require('./controllers/ftwebservice.js'));


app.use(logger(process.env.LOG_FORMAT || (app.get('env') === 'development' ? 'dev' : 'combined')));
app.use(express.static(path.resolve(process.cwd(), 'resources/public')));


// Routes which don't require Staff Single Sign-On
app.get('/feed', require('./controllers/feed.js'));


// Add Staff Single Sign-On middleware
if(app.get('env') !== 'development') {
	app.use(authS3O);
}

// Routes which require Staff Single Sign-On
app.get('/', require('./controllers/admin.js'));


app.listen(port, () => console.log('Up and running on port', port));
