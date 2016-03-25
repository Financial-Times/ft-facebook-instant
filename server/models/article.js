'use strict';

const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const path = require('path');
const denodeify = require('denodeify');
const database = require('../lib/database');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';

const diskCache = cacheManager.caching({
	store: fsStore,
	options: {
		ttl: 6 * 60 * 60, // time to live in seconds
		maxsize: 20 * 1024 * 1024, // max on-disk cache size in bytes
		path: path.resolve(process.cwd(), 'cache/articles'), // path for on-disk cache
		preventfill: false, // prevent automatically populating the memory cache with existing files
		fillcallback: undefined, // callback fired after the initial cache filling is completed
		zip: false, // zip cache files on disk to save space
	},
});

const cacheSet = denodeify(diskCache.set);
const cacheGet = denodeify(diskCache.get);
const cacheDel = denodeify(diskCache.del);

const apiFetch = uuid => signedFetch(`https://${elasticSearchUrl}/${index}/item/${uuid}`)
.then(fetchres.json)
.then(json => json._source);

const getApi = uuid => cacheGet(uuid)
.then(cached => {
	if(cached) {
		return cached;
	}

	return apiFetch(uuid)
		.then(article => cacheSet(uuid, article));
});

const get = uuid => Promise.all([
	database.get(uuid),
	getApi(uuid),
])
.then(results => {
	const [databaseRecord, apiRecord] = results;
	return {databaseRecord, apiRecord};
})
.then(results => {
	if(results.databaseRecord) {
		return results;
	}

	const {apiRecord} = results;

	return database.set({
		uuid: apiRecord.id,
		title: apiRecord.title,
		date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
		date_record_updated: Date.now(),
	})
	.then(() => database.get(uuid))
	.then(databaseRecord => ({databaseRecord, apiRecord}));
})
.then(results => {
	const {databaseRecord, apiRecord} = results;
	const feedModel = require('../models/feed');

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

	article.apiArticle = apiRecord;
	return article;
});

const publish = (feedType, uuid) => database.publish(feedType, uuid);

const unpublish = (feedType, uuid) => database.unpublish(feedType, uuid);

const update = article => {
	article.date_record_updated = Date.now();
	return Promise.all([
		cacheDel(article.uuid),
		database.set(article),
	]);
};

const transform = article => article.apiArticle.bodyXML.replace(/[^\w\s]+/g, ' ');

module.exports = {
	getApi,
	get,
	update,
	publish,
	unpublish,
	transform,
};

