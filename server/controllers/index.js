'use strict';

const testUuids = require('../lib/testUuids');
const fbApi = require('../lib/fbApi');
const articleModel = require('../models/article');

module.exports = (req, res, next) => fbApi.list({fields: ['canonical_url']})
.then(fbList => {
	const promises = fbList.map(({canonical_url}) => articleModel.ensureInDb(canonical_url));
	return Promise.all(promises);
})
.then(fbList => Promise.all(fbList.map(fbItem => articleModel.get(fbItem.canonical))))
// .then(articles => res.json(articles));
.then(articles => res.render('index', {
	articles,
	testUuids,
}))
.catch(next);
