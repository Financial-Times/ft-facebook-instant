'use strict';

const articleModel = require('../models/article');

module.exports = (req, res, next) => {
	const uuid = req.params.uuid;

	return articleModel.getApi(uuid)
	.then(article => res.json(article))
	.catch(next);
};
