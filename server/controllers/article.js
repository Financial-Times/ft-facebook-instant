'use strict';

const renderer = require('../lib/renderer');
const fetchArticle = require('../lib/fetchArticle');
const database = require('../lib/database');
const articleModel = require('../models/article');
const feedModel = require('../models/feed');

module.exports = (req, res) => {
	const uuid = req.params.uuid;

	let article;

	return Promise.all([
		fetchArticle(uuid),
		database.fetch(uuid),
	])
	.then(items => {
		const [apiRecord, databaseRecord] = items;
		article = articleModel.merge(articleModel.fromDatabase(databaseRecord), apiRecord);

		console.log('article apiRecord', apiRecord.title);
		console.log('article databaseRecord', databaseRecord);
		console.log('article merged article', article);

		const templateData = {
			uuid: article.id,
			title: article.title,
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
		database.update(article);
	})
	.then(database.list)
	.then(list => console.log('All articles:', list))
	.catch(err => renderer.outputError(err, res));
};
