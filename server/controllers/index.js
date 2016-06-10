'use strict';

const testUuids = require('../lib/testUuids');
const fbApi = require('../lib/fbApi');
const articleModel = require('../models/article');

const DEFAULT_LIMIT = 50;

module.exports = (req, res, next) => fbApi.list({fields: ['canonical_url'], __limit: (req.params.all ? 0 : DEFAULT_LIMIT)})
.then(articles => articles.map(article => article.canonical_url))
.then(canonicals => articleModel.getList(canonicals))
.then(articles => (
	req.accepts(['html', 'json']) === 'json' ?
		data => res.json(data) :
		data => res.render('index', data)
	)({
		articles,
		testUuids,
	})
)
.catch(next);
