'use strict';

const testUuids = require('../lib/testUuids');
const database = require('../lib/database');
const fbApi = require('../lib/fbApi');

module.exports = (req, res, next) => Promise.all([
	database.list(),
	fbApi.list(),
])
.then(([db, fb]) => {
	// res.json({db, fb});
})
.then(articles => res.render('index', {
	articles,
	testUuids,
}))
.catch(next);
