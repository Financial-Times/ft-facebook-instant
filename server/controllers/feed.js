"use strict";

const feed = require('../lib/feed');
const auth = require('basic-auth');

const checkAuth = req => {

	console.log('process.env.NODE_ENV', process.env.NODE_ENV);
	if ('production' !== process.env.NODE_ENV) return true;

	const credentials = auth(req);
	if (credentials && credentials.name === 'facebook' && credentials.pass === process.env.HTTP_AUTH_PASS) {
		return true;
	}

	return false;
};

module.exports = (req, res) => {
	if (!checkAuth(req)) {
		res.statusCode = 401;
		res.setHeader('WWW-Authenticate', 'Basic realm="feed"');
		return res.end('Access denied');
	}

	res.send(feed.generate());
};
