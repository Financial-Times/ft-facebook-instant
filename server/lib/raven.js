'use strict';

const raven = require('raven');
const contextErrorHandler = require('@georgecrawford/raven-express-context-errorhandler');
const os = require('os');
const {version} = require('../../package.json');

let ravenClient;

raven.Client.prototype.captureRichException = (err, kwargs = {}, cb) => {
	// Merge any Sentry-like fields from the Error to the raven args
	['tags', 'extra', 'user'].forEach(field => {
		if(err[field] && (typeof err[field] === 'object')) {
			kwargs[field] = Object.assign(err[field], kwargs[field]);
		}
	});
	return ravenClient.captureException.call(ravenClient, err, kwargs, cb);
};

const init = (sendToSentry = false) => {
	// A falsy value for the DSN disables sending events upstream
	ravenClient = new raven.Client((sendToSentry && process.env.SENTRY_DSN), {
		release: version,
		name: process.env.HEROKU_APP_NAME || os.hostname(),
		extra: {
			env: process.env,
		},
		tags: {
		},
	});

	return ravenClient;
};

module.exports = {
	init,
	errorHandler: contextErrorHandler,
	requestHandler: raven.middleware.express.requestHandler,
	get client() {
		return ravenClient;
	},
};
