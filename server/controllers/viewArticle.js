'use strict';

const renderer = require('../lib/renderer');
const fetchArticle = require('../lib/fetchArticle');

module.exports = (req, res) => {
	const uuid = req.params.uuid;
	const feeds = ['development', 'production'];

	return fetchArticle(uuid)
	.then(article => {
		const templateData = {
			uuid: article.id,
			title: article.title,
			errors: ['test1', 'test2'],
		};

		return Promise.all(feeds.map(feed => renderer.renderTemplate('article-feed-status', {
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
	})
	.catch(err => renderer.outputError(err, res));
};
