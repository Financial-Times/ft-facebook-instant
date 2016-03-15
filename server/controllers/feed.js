'use strict';

const renderer = require('../lib/renderer');
const feed = require('../lib/feed');
const auth = require('basic-auth');

const types = ['development', 'production'];

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

	const type = req.params.type || 'production';
	feed.generate(type)
	.then(rss => {
		res.set('Content-Type', 'application/rss+xml');
		res.send(rss);
	})
	.catch(err => renderer.outputError(err, res));
};

module.exports.types = types;
