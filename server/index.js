'use strict';

const express = require('express');
const app = express();

const mode = (app.get('env') === 'production') ?
	'production' :
	'development';
require('./lib/mode').set(mode);

const cookieParser = require('cookie-parser');
const handlebars = require('./lib/handlebars');
const ftwebservice = require('express-ftwebservice');
const authS3O = require('s3o-middleware');
const assertEnv = require('@quarterto/assert-env');
const logger = require('morgan');
const favicon = require('serve-favicon');
const path = require('path');
const bodyParser = require('body-parser');
const raven = require('raven');
const noCache = require('./lib/nocache');
const devController = require('./controllers/dev');
const indexController = require('./controllers/index');
const articleController = require('./controllers/article');
const notificationsController = require('./controllers/notifications');
const insightsController = require('./controllers/insights');
const republishController = require('./controllers/updateRepublish');
const apiController = require('./controllers/api');

const port = process.env.PORT || 6247;

let ravenClient;

if(app.get('env') === 'development') {
	process.on('uncaughtException', error => {
		console.error(`${Date()}: uncaughtException`);
		console.error(error.stack);
		process.exit(1);
	});
} else {
	assertEnv(['SENTRY_DSN']);
	ravenClient = require('./lib/raven');
	ravenClient.patchGlobal(() => process.exit(1));
}

assertEnv([
	'AWS_ACCESS_KEY',
	'AWS_SECRET_ACCESS_KEY',
	'ELASTIC_SEARCH_DOMAIN',
	'ES_INTERFACE_API_KEY',
	'REDIS_URL',
	'API_V1_KEY',
	'FB_PAGE_ID',
	'FB_APP_ID',
	'FB_APP_SECRET',
	'FB_PAGE_ACCESS_TOKEN',
	'FB_INITIAL_USER_ID',
	'BRIGHTCOVE_ACCOUNT_ID',
	'SPOOR_API_KEY',
	'SEGMENT_ID',
]);

if(app.get('env') !== 'development') {
	app.use(raven.middleware.express.requestHandler(ravenClient));
	app.use((req, res, next) => {
		ravenClient.setExtraContext(raven.parsers.parseRequest(req));
		req.raven = ravenClient;
		next();
	});
}

/* Middleware */

// __about, __gtg, etc.
ftwebservice(app, require('./controllers/ftWebService'));

app.use(favicon(path.resolve(process.cwd(), 'resources/public/favicon.ico')));

app.use(cookieParser());

// Handlebars middleware
handlebars(app);

// S30, but not in dev
if(app.get('env') !== 'development') {
	app.use(authS3O);
}

// Other
app.use(logger(process.env.LOG_FORMAT || (app.get('env') === 'development' ? 'dev' : 'combined')));
app.use(express.static(path.resolve(process.cwd(), 'resources/public')));
app.use(bodyParser.urlencoded({extended: true}));

/*  Routes */

app.route('^/$').get(noCache).get(handlebars.exposeTemplates, indexController);

app.route('^/article/:url$').get(noCache).get(handlebars.exposeTemplates).get(articleController);

app.route('^/article/:url/api$').get(apiController);

// TODO: change these to post only, and remove debugging routes
app.route(`^/article/:url/:mode(${mode})?/:action$`).all(noCache).all(articleController);

app.route('^/republish$').post(republishController.route);

app.route('^/reload-s3o$').get((req, res, next) => {
	res.render('reload-s30');
});

app.route('^/insights$').all(noCache).get(insightsController);


// Dev-only routes
app.route('^/dev/:action').get(noCache).get(devController);


/* Errors */

if(app.get('env') !== 'development') {
	app.use(raven.middleware.express.errorHandler(ravenClient));
}

const logErrors = (error, req, res, next) => {
	console.error(`${Date()}: LOGERRORS: ${error.stack || error}`);
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

if(process.env.DISABLE_NOTIFICATIONS) {
	console.log(`${Date()}: DISABLE_NOTIFICATIONS flag prevented notificationsController initialisation`);
} else {
	notificationsController.init();
}

if(process.env.DISABLE_REPUBLISH) {
	console.log(`${Date()}: DISABLE_REPUBLISH flag prevented republishController initialisation`);
} else if(app.get('env') !== 'production') {
	republishController();
}

app.listen(port, () => console.log(`${Date()}: Up and running on port ${port} in ${mode} mode.`));
