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

const devController = require('./controllers/dev');
const feedController = require('./controllers/feed');
const indexController = require('./controllers/index');
const articleController = require('./controllers/article');
const notificationsController = require('./controllers/notifications');
const apiController = require('./controllers/api');
const uuidParam = `:uuid(${uuidRegex.raw})`;
const feedTypesList = feedModel.types.join('|');

assertEnv([
	'AWS_ACCESS_KEY',
	'AWS_SECRET_ACCESS_KEY',
	'ELASTIC_SEARCH_DOMAIN',
	'HTTP_AUTH_PASS',
	'REDIS_URL',
	'API_V1_KEY',
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

// Routes which don't require Staff Single Sign-On
app.route(`/feed/:type(${feedTypesList})?`).get(noCache).get(feedController);

// Add Staff Single Sign-On middleware
if(app.get('env') !== 'development') {
	app.use(authS3O);
}

// Routes which require Staff Single Sign-On
app.route('/').get(noCache).get(handlebars.exposeTemplates, indexController);

app.route(`^/${uuidParam}$`).get(noCache).get(handlebars.exposeTemplates).get(articleController);

app.route(`^/${uuidParam}/api$`).get(apiController);

app.route(`^/${uuidParam}/:feed(${feedTypesList})?/:action(get|publish|unpublish)$`).post(noCache).post(articleController);

// Dev-only routes - TODO, remove these in prod
app.route(`^/${uuidParam}/:feed(${feedTypesList})?/:action(get|transform|update)$`).get(noCache).get(articleController);
app.route('^/dev/:action').get(noCache).get(devController);


/* Errors */

const logErrors = (error, req, res, next) => {
	console.error(error.stack);
	next(error);
};

const clientErrorHandler = (error, req, res, next) => {
	const message = {
		error: error.toString(),
		stack: (app.get('env') === 'development') && error.stack,
	};

	res.status(400);

	if(req.xhr) {
		res.json(message);
	} else {
		res.render('error', message);
	}
};

const notFoundHandler = (req, res) => {
	const message = {
		error: `Path [${req.originalUrl}] not recognised`,
	};
	res.status(404);
	if(req.xhr) {
		res.json(message);
	} else {
		res.render('error', message);
	}
};

app.use(logErrors);
app.use(clientErrorHandler);
app.use(notFoundHandler);


/* Start */

notificationsController.init();

app.listen(port, () => console.log('Up and running on port', port));
