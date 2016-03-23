'use strict';

const feed = require('../models/feed');
const database = require('../lib/database');
const auth = require('basic-auth');

const checkAuth = req => {
	if(!req.query.__forceauth && process.env.NODE_ENV !== 'production') return true;

	const credentials = auth(req);
	if(credentials && credentials.name === 'facebook' && credentials.pass === process.env.HTTP_AUTH_PASS) {
		return true;
	}

	return false;
};

module.exports = (req, res, next) => {
	if(!checkAuth(req)) {
		res.statusCode = 401;
		res.setHeader('WWW-Authenticate', 'Basic realm="feed"');
		return res.send('Access denied');
	}

	const type = req.params.type || 'production';
	if(feed.types.indexOf(type) === -1) {
		throw Error(`Unrecognised feed type [${type}]`);
	}

	return database.feed(type)
		.then(articles => feed.generate(type, articles))
		.then(rss => {
			res.set('Content-Type', 'application/rss+xml');
			res.send(rss);
		})
		.catch(next);
};
