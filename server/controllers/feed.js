'use strict';

const feed = require('../models/feed');
const database = require('../lib/database');
const auth = require('basic-auth');
const fetchArticle = require('../lib/fetchArticle');

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
		.then(feedList => {
			const promises = Object.keys(feedList).map(uuid => fetchArticle(uuid)
				.then(apiArticle => {
					const article = feedList[uuid];
					article.apiArticle = apiArticle;
					return article;
				})
			);

			return Promise.all(promises)
				.then(articles => {
					const rss = feed.generate(type, articles);
					const impressions = articles.map(article => database.impression(type, article.uuid));

					return Promise.all(impressions)
						.then(() => rss);
				});
		})
		.then(rss => {
			res.set('Content-Type', 'application/rss+xml');
			res.send(rss);
		})
		.catch(next);
};
