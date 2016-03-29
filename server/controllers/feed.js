'use strict';

const feedModel = require('../models/feed');
const articleModel = require('../models/article');
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

const isFacebookCrawler = req => /facebookexternalhit/.test(req.get('User-Agent'));

module.exports = (req, res, next) => {
	if(!checkAuth(req)) {
		res.statusCode = 401;
		res.setHeader('WWW-Authenticate', 'Basic realm="feed"');
		return res.send('Access denied');
	}

	const type = req.params.type || 'production';
	if(feedModel.types.indexOf(type) === -1) {
		throw Error(`Unrecognised feed type [${type}]`);
	}

	return database.feed(type)
		.then(feedList => Promise.all(Object.keys(feedList).map(uuid => articleModel.get(uuid))))
		.then(articles => feedModel.generate(type, articles)
			.then(rss => {
				if(isFacebookCrawler(req)) {
					const impressions = articles.map(article => database.impression(type, article.uuid));
					return Promise.all(impressions)
						.then(() => rss);
				}
				return rss;
			})
		)
		.then(rss => {
			res.set('Content-Type', 'application/rss+xml');
			res.send(rss);
		})
		.catch(next);
};
