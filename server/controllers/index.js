'use strict';

const testUuids = require('../lib/testUuids');
const fbApi = require('../lib/fbApi');
const articleModel = require('../models/article');

module.exports = (req, res, next) => fbApi.list({fields: ['canonical_url'], __limit: 0})
.then(articles => articles.map(article => article.canonical_url))
.then(canonicals => articleModel.getList(canonicals))
.then(articles => articles.sort((a, b) => b.date_record_updated - a.date_record_updated))
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
