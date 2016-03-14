'use strict';

const renderer = require('../lib/renderer');
const fetchArticle = require('../lib/fetchArticle');

module.exports = (req, res) => {
	const uuid = req.params.uuid;

	return fetchArticle(uuid)
	.then(article => {
		const templateData = {
			uuid: article.id,
			title: article.title,
		};
		return renderer.renderTemplate('article-status', templateData);
	})
	.then(fragmentHTML => {
		res.send(fragmentHTML);
	})
	.catch(err => renderer.outputError(err, res));
};
