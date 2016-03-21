'use strict';

const renderer = require('../lib/renderer');
const fetchArticle = require('../lib/fetchArticle');
const database = require('../lib/database');
const feedModel = require('../models/feed');
const moment = require('moment');

const getArticle = uuid => database.get(uuid)
.then(databaseRecord => {
	if(databaseRecord) return Promise.resolve(databaseRecord);

	return fetchArticle(uuid)
		.then(apiRecord => ({
			uuid: apiRecord.id,
			title: apiRecord.title,
			date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
		}))
		.then(article => database.update(article))
		.then(database.get(uuid));
})
.then(article => {
	Object.keys(article).forEach(key => {
		if(key.indexOf('date_') === 0 && /\d+/.test(article[key])) {
			const date = moment(parseInt(article[key], 10));
			article[key] = date.format();
			article[`${key}_formatted`] = date.fromNow();
		}
	});

	return article;
});

module.exports = (req, res) => {
	const uuid = req.params.uuid;

	return getArticle(uuid)
	.then(article => Promise.all(
			feedModel.types.map(feed => renderer.renderTemplate('article-feed-status', {
				feed,
				status: 'Not published',
			}))
		)
		.then(feedHTML => {
			article.feeds = feedHTML;
		})
		.then(() => renderer.renderTemplate('article-status', article))
	)
	.then(fragmentHTML => {
		res.send(fragmentHTML);
	})
	.catch(err => renderer.outputError(err, res));
};

module.exports.action = (req, res) => {
	const uuid = req.params.uuid;
	const action = req.params.action;

	return Promise.resolve()
	.then(() => {
		switch(action) {
			case 'add-update':
				return getArticle(uuid)
					.then(database.update);

			case 'list':
				return database.list();

			case 'get':
				return database.getArticle(uuid);

			case 'wipe':
				return database.wipe();

			case 'publish':
				return database.publish('development', uuid);

			case 'unpublish':
				return database.unpublish('development', uuid);

			case 'feed':
				return database.feed('development')
					.then(articles => {
						const promises = Object.keys(articles)
							.map(thisUuid => database.impression('development', thisUuid));
						return Promise.all(promises)
							.then(impressionCounts => ({articles, impressionCounts}));
					});


			default:
				return Promise.resolve(`Action ${action} not recognised.`);
		}
	})
	.then(replies => res.send(`${action}<br /><code><pre>${JSON.stringify(replies, null, '\t')}`))
	.catch(err => renderer.outputError(err, res));
};
