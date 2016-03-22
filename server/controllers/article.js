'use strict';

const fetchArticle = require('../lib/fetchArticle');
const database = require('../lib/database');
const testUuids = require('../lib/testUuids');
const moment = require('moment');


// TODO: handlebars helper?
const formatDates = obj => {
	Object.keys(obj).forEach(key => {
		if(key.indexOf('date_') === 0 && /\d+/.test(obj[key])) {
			const date = moment(parseInt(obj[key], 10));
			obj[key] = date.format();
			obj[`${key}_formatted`] = date.fromNow();
		}
	});
};

const getArticle = uuid => database.get(uuid)
.then(databaseRecord => {
	if(databaseRecord) return Promise.resolve(databaseRecord);

	return fetchArticle(uuid)
		.then(apiRecord => ({
			uuid: apiRecord.id,
			title: apiRecord.title,
			date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
		}))
		.then(article => database.update(article))
		.then(() => database.get(uuid));
})
.then(databaseRecord => {
	const article = {
		uuid: databaseRecord.uuid,
		title: databaseRecord.title,
		date_editorially_published: databaseRecord.date_editorially_published,
		date_record_updated: databaseRecord.date_record_updated,
		feeds: [
			{
				feed: 'development',
				date_published: databaseRecord.date_published_development,
				date_imported: databaseRecord.date_imported_development,
				impressions: databaseRecord.development_impressions,
			},
			{
				feed: 'production',
				date_published: databaseRecord.date_published_production,
				date_imported: databaseRecord.date_imported_production,
				impressions: databaseRecord.production_impressions,
			},
		],
	};

	formatDates(article);
	article.feeds.forEach(formatDates);

	return article;
});

const runAction = (action, uuid = null) => {
	switch(action) {
		case 'add-update':
			return getArticle(uuid)
				.then(database.update);

		case 'list':
			return database.list();

		case 'get':
			return getArticle(uuid);

		case 'wipe':
			return database.wipe();

		case 'publish':
			return database.publish('development', uuid);

		case 'unpublish':
			return database.unpublish('development', uuid);

		case 'feed':
			return database.feed('development')
				.then(articles => {
					const promises = Object.keys(articles)
						.map(thisUuid => database.impression('development', thisUuid));
					return Promise.all(promises)
						.then(impressionCounts => ({articles, impressionCounts}));
				});


		default:
			return Promise.resolve(`Action ${action} not recognised.`);
	}
};

module.exports = (req, res, next) => {
	const uuid = req.params.uuid;
	const action = req.params.action;

	return Promise.resolve()
	.then(() => {
		if(!action) {
			return getArticle(uuid)
				.then(article => (console.log(article), article))
				.then(article => res.render('index', {
					uuid,
					article,
					testUuids,
				}))
				.catch(next);
		}

		return runAction(action, uuid)
			.then(() => getArticle(uuid))
			.then(fragmentHTML => {
				res.send(fragmentHTML);
			});
	})
	.catch(next);
};
