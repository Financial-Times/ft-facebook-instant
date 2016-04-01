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

const port = process.env.PORT || 6247;
const app = express();

const devController = require('./controllers/dev');
const indexController = require('./controllers/index');
const articleController = require('./controllers/article');
const notificationsController = require('./controllers/notifications');
const apiController = require('./controllers/api');

const modeList = 'development|production';

assertEnv([
	'AWS_ACCESS_KEY',
	'AWS_SECRET_ACCESS_KEY',
	'ELASTIC_SEARCH_DOMAIN',
	'REDIS_URL',
	'API_V1_KEY',
	'FB_PAGE_ID',
	'FB_APP_ID',
	'FB_PAGE_ACCESS_TOKEN',
]);


/* Middleware */

// __about, __gtg, etc.
ftwebservice(app, require('./controllers/ftWebService'));

// Handlebars middleware
handlebars(app);

// S30 in prod only
if(app.get('env') !== 'development') {
	app.use(authS3O);
}

// Other
app.use(logger(process.env.LOG_FORMAT || (app.get('env') === 'development' ? 'dev' : 'combined')));
app.use(express.static(path.resolve(process.cwd(), 'resources/public')));
app.use(bodyParser.urlencoded({extended: true}));

/*  Routes */

app.route('^/$').get(noCache).get(handlebars.exposeTemplates, indexController);

app.route(`^/article/:url$`).get(noCache).get(handlebars.exposeTemplates).get(articleController);

app.route(`^/article/:url/api$`).get(apiController);

// TODO: change these to post only, and remove debugging routes
app.route(`^/article/:url/:mode(${modeList})?/:action$`).all(noCache).all(articleController);

// Dev-only routes
app.route('^/dev/:action').get(noCache).get(devController);


/* Errors */

const logErrors = (error, req, res, next) => {
	console.error('LOGERRORS', error.stack || error);
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
