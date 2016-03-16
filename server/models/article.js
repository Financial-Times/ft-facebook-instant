'use strict';

const feed = require('./feed');

const timestamp = datetime => new Date(datetime).getTime();

const fromDatabase = rawDatabaseRecord => {
	if(!rawDatabaseRecord) return {};

	const article = {
		uuid: rawDatabaseRecord.uuid,
		title: rawDatabaseRecord.title,
		date_published: rawDatabaseRecord.date_published,
		date_updated: rawDatabaseRecord.date_updated,
		feeds: {},
	};

	feed.types.forEach(type => {
		article.feeds[type] = article.feeds[type] || {};
		article.feeds[type].published = rawDatabaseRecord[`feeds:${type}:published`];
	});

	return article;
};

const merge = (databaseRecord, apiRecord) => {
	const article = Object.assign(databaseRecord || {}, {
		uuid: apiRecord.id,
		title: apiRecord.title,
		date_published: timestamp(apiRecord.publishedDate),
		date_updated: Date.now(),
		feeds: {},
	});

	feed.types.forEach(type => {
		article.feeds[type] = Object.assign(article.feeds[type] || {}, {
			published: false,
		});
	});

	return article;
};

module.exports = {
	fromDatabase,
	merge,
};
