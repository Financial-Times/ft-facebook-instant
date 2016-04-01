'use strict';

const articleModel = require('../models/article');

module.exports = (req, res, next) => {
	const url = req.params.url;

	return articleModel.getApi(url)
	.then(article => res.json(article))
	.catch(next);
};
