'use strict';

const testUuids = require('../lib/testUuids');
const fbApi = require('../lib/fbApi');
const database = require('../lib/database');
const articleModel = require('../models/article');

module.exports = (req, res, next) => fbApi.list({fields: ['canonical_url']})
.then(fbList => {
	const promises = fbList.map(({canonical_url}) => articleModel.ensureInDb(canonical_url));
	return Promise.all(promises);
})
.then(() => database.list())
.then(dbList => Promise.all(dbList.map(dbItem => articleModel.enrichDb(dbItem))))
.then(articles => res.render('index', {
	articles,
	testUuids,
	modes: ['production', 'development'],
}))
.catch(next);
