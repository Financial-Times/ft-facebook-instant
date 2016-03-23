'use strict';

const fetchArticle = require('../lib/fetchArticle');
const database = require('../lib/database');
const testUuids = require('../lib/testUuids');
const feedModel = require('../models/feed');

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
	};

	article.feeds = feedModel.types.map(type => ({
		feed: type,
		date_published: databaseRecord[`date_published_${type}`],
		date_imported: databaseRecord[`date_imported_${type}`],
		impressions: databaseRecord[`${type}_impressions`],
	}));

	return article;
});

const checkParams = params => {
	const required = {
		list: [],
		wipe: [],
		get: ['uuid'],
		publish: ['uuid', 'feed'],
		unpublish: ['uuid', 'feed'],
		feed: ['uuid'],
	};
	const {action} = params;

	if(!required[action]) {
		throw Error(`Action [${action}] not recognised.`);
	}

	required[action].forEach(key => {
		if(!params[key]) {
			throw Error(`Missing required parameter [${key}] for action [${action}].`);
		}
	});

	return params;
};

const runAction = params => {
	const {uuid, feed, action} = checkParams(params);

	switch(action) {
		case 'list':
			return database.list();

		case 'get':
			return getArticle(uuid);

		case 'wipe':
			return database.wipe();

		case 'publish':
			return database.publish(feed, uuid);

		case 'unpublish':
			return database.unpublish(feed, uuid);

		case 'feed':
			return database.feed(feed)
				.then(articles => {
					const promises = Object.keys(articles)
						.map(thisUuid => database.impression(feed, thisUuid));
					return Promise.all(promises)
						.then(impressionCounts => ({articles, impressionCounts}));
				});

		default:
			throw Error(`Action [${action}] not recognised.`);
	}
};

module.exports = (req, res, next) => {
	const uuid = req.params.uuid;
	const feed = req.params.feed;
	const action = req.params.action;

	return Promise.resolve()
	.then(() => {
		if(!action) {
			return getArticle(uuid)
				.then(article => res.render('index', {uuid, article, testUuids}));
		}

		return runAction({uuid, feed, action})
			.then(() => getArticle(uuid))
			.then(response => res.send(response));
	})
	.catch(next);
};
