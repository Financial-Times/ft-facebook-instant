'use strict';

const fetchArticle = require('../lib/fetchArticle');

module.exports = (req, res, next) => {
	const uuid = req.params.uuid;

	return fetchArticle(uuid)
	.then(article => res.json(article))
	.catch(next);
};
