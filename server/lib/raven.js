'use strict';

const raven = require('raven');
const contextErrorHandler = require('@georgecrawford/raven-express-context-errorhandler');
const os = require('os');
const {version} = require('../../package.json');

let ravenClient;

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
