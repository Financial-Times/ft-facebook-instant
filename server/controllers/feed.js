'use strict';

const feed = require('../lib/feed');
const auth = require('basic-auth');

const checkAuth = req => {
	if(!req.query.__forceauth && process.env.NODE_ENV !== 'production') return true;

	const credentials = auth(req);
	if(credentials && credentials.name === 'facebook' && credentials.pass === process.env.HTTP_AUTH_PASS) {
		return true;
	}

	return false;
};

module.exports = (req, res) => {
	if(!checkAuth(req)) {
		res.statusCode = 401;
		res.setHeader('WWW-Authenticate', 'Basic realm="feed"');
		return res.send('Access denied');
	}

	res.set('Content-Type', 'application/rss+xml');
	res.send(feed.generate());
};
