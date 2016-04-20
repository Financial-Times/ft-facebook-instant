'use strict';

const testUuids = require('../lib/testUuids');
const fbApi = require('../lib/fbApi');
const articleModel = require('../models/article');

const inflate = fbItem => articleModel.get(fbItem.canonical_url)
.catch(e => {
	if(e.type === 'FtApiContentMissingException') {
		console.log(`${Date()}: INDEX: Removing missing article from articles list: ${fbItem.canonical}`);
		return null;
	}
	throw e;
});

module.exports = (req, res, next) => fbApi.list({fields: ['canonical_url']})
.then(fbList => Promise.all(fbList.map(inflate)))
.then(articles => articles

	// Remove deleted (null) articles
	.filter(article => !!article)
	.sort((a, b) => b.date_record_updated - a.date_record_updated)
)
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
