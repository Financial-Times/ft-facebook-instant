'use strict';

const raven = require('raven');
const os = require('os');
const {version} = require('../../package.json');

const ravenClient = new raven.Client(process.env.SENTRY_DSN, {
	release: version,
	name: process.env.HEROKU_APP_NAME || os.hostname(),
	extra: {
		env: process.env,
	},
	tags: {
	},
});

module.exports = ravenClient;
