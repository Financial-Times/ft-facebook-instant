'use strict';

const raven = require('raven');
const os = require('os');

const ravenClient = new raven.Client(process.env.SENTRY_DSN);
ravenClient.setExtraContext({env: process.env});
ravenClient.setTagsContext({
	server_name: process.env.HEROKU_APP_NAME || os.hostname(),
	release: process.env.HEROKU_SLUG_COMMIT,
});

ravenClient.patchGlobal(() => process.exit(1));

module.exports = ravenClient;
