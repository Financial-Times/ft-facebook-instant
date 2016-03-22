'use strict';

const express = require('express');
const handlebars = require('./lib/handlebars');
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

const feedModel = require('./models/feed');

const feedController = require('./controllers/feed');
const indexController = require('./controllers/index');
const articleController = require('./controllers/article');
const apiController = require('./controllers/api');
const uuidParam = `:uuid(${uuidRegex.raw})`;

assertEnv([
	'AWS_ACCESS_KEY',
	'AWS_SECRET_ACCESS_KEY',
	'ELASTIC_SEARCH_DOMAIN',
	'HTTP_AUTH_PASS',
	'REDIS_URL',
]);

if(app.get('env') !== 'development') {
	assertEnv([
		'HTTP_AUTH_PASS',
	]);
}

/* Middleware */

// __about, __gtg, etc.
ftwebservice(app, require('./controllers/ftWebService'));

// Handlebars middleware
handlebars(app);

// Other
app.use(logger(process.env.LOG_FORMAT || (app.get('env') === 'development' ? 'dev' : 'combined')));
app.use(express.static(path.resolve(process.cwd(), 'resources/public')));
app.use(bodyParser.urlencoded({extended: true}));


/*  Routes */

// // Routes which don't require Staff Single Sign-On
app.route(`/feed/:type(${feedModel.types.join('|')})?`).get(noCache).get(feedController);
app.route(`/api/${uuidParam}$`).get(apiController);

// Add Staff Single Sign-On middleware
if(app.get('env') !== 'development') {
	app.use(authS3O);
}

// Routes which require Staff Single Sign-On
app.route('/').get(noCache).get(indexController);

app.route(`^/${uuidParam}$`).get(noCache).get(articleController);

// app.route(`^/${uuidParam}$`).post(noCache).post(articleController);
// app.route(`^/${uuidParam}/:action(get|publish|unpublish)$`).post(noCache).post(articleController);

// // Dev-only, to be removed
// app.route(`^/${uuidParam}/:action`).get(noCache).get(articleController);


/* Errors */

const logErrors = (error, req, res, next) => {
	console.error(error.stack);
	next(error);
};

const clientErrorHandler = (error, req, res, next) => {
	if(req.xhr) {
		res.status(500).send({
			error,
		});
	} else {
		next(error);
	}
};

const errorHandler = (error, req, res, next) => {
	res.status(500);
	res.render('error', {
		error,
		stack: (app.get('env') === 'development') && error.stack,
	});
};

app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);


/* Start */

app.listen(port, () => console.log('Up and running on port', port));
