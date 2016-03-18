'use strict';

const renderer = require('../lib/renderer');
const fetchArticle = require('../lib/fetchArticle');
const database = require('../lib/database');
// const articleModel = require('../models/article');
const feedModel = require('../models/feed');

module.exports = (req, res) => {
	const uuid = req.params.uuid;

	let article;

	return Promise.all([
		fetchArticle(uuid),
		database.get(uuid),
	])
	.then(items => {
		const [apiRecord, databaseRecord] = items;
		// const [apiRecord] = items;
		// article = articleModel.merge(articleModel.fromDatabase(databaseRecord), apiRecord);

		article = {
			uuid: apiRecord.id,
			title: apiRecord.title,
			date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
			date_updated: databaseRecord && databaseRecord.date_updated,
		};

		console.log('article apiRecord', apiRecord.title);
		console.log('article databaseRecord', databaseRecord);
		// console.log('article merged article', article);

		const templateData = {
			uuid: apiRecord.id,
			title: apiRecord.title,
		};

		return Promise.all(feedModel.types.map(feed => renderer.renderTemplate('article-feed-status', {
			feed,
			status: 'Not published',
		})))
		.then(feedHTML => {
			templateData.feeds = feedHTML;
		})
		.then(() => renderer.renderTemplate('article-status', templateData));
	})
	.then(fragmentHTML => {
		res.send(fragmentHTML);
		return database.update(article);
	})
	// .then(database.list)
	// .then(list => console.log('All articles:', list))
	.catch(err => renderer.outputError(err, res));
};

const get = uuid => Promise.all([
	fetchArticle(uuid),
	database.get(uuid),
])
.then(items => {
	const [apiRecord, databaseRecord] = items;

	return {
		uuid: apiRecord.id,
		title: apiRecord.title,
		date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
		date_updated: databaseRecord && databaseRecord.date_updated,
	};
});

module.exports.action = (req, res) => {
	const uuid = req.params.uuid;
	const action = req.params.action;

	return Promise.resolve()
	.then(() => {
		switch(action) {
			case 'add-update':
				return get(uuid)
					.then(database.update);

			case 'list':
				return database.list();

			case 'get':
				return database.get(uuid);

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
