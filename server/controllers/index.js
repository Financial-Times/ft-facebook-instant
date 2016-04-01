'use strict';

const testUuids = require('../lib/testUuids');
const database = require('../lib/database');
const fbApi = require('../lib/fbApi');

module.exports = (req, res, next) => Promise.all([
	database.list(),
	fbApi.list(),
])
.then(([db, fb]) => {
	// const articles = {
	// 	production: [],
	// 	development: [],
	// 	draft: [],
	// };

	// // all FB prod, adding any related imports
	// const production = fb.filter(fbRecord => !fbRecord.development_mode);
	// production.forEach(fbRecord => {
	// 	const dbRecord = db.find(item => item.canonical === fbRecord.canonical_url);
	// 	if(dbRecord)
	// });

	// All FB dev which aren't in prod, adding any related imports

	// All remaining db records

	// res.json({db, fb});
})
.then(articles => res.render('index', {
	articles,
	testUuids,
}))
.catch(next);
