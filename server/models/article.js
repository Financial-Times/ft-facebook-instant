'use strict';

const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const path = require('path');
const denodeify = require('denodeify');
const database = require('../lib/database');
const fetch = require('node-fetch');
const url = require('url');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';

const modes = ['development', 'production'];

const getCanonical = uuid => {
	const original = `http://www.ft.com/content/${uuid}`;
	return fetch(original)
	.then(response => {
		const parsed = url.parse(response.url);
		return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
	});
};

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

const updateDb = apiRecord => getCanonical(apiRecord.id)
.then(canonical => database.set({
	canonical,
	uuid: apiRecord.id,
	title: apiRecord.title,
	date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
	date_record_updated: Date.now(),
}))
.then(() => database.get(apiRecord.id));

const mergeRecords = records => {
	const [databaseRecord, apiRecord] = records;
	const article = {
		uuid: databaseRecord.uuid,
		title: databaseRecord.title,
		canonical: databaseRecord.canonical,
		date_editorially_published: databaseRecord.date_editorially_published,
		date_record_updated: databaseRecord.date_record_updated,
	};

	article.modes = modes.map(mode => ({
		mode,
		date_published: databaseRecord[`date_published_${mode}`],
		date_imported: databaseRecord[`date_imported_${mode}`],
	}));

	article.apiArticle = apiRecord;
	return article;
};

const get = uuid => Promise.all([
	database.get(uuid),
	getApi(uuid),
])
.then(results => {
	const [existingDatabaseRecord, apiRecord] = results;

	if(existingDatabaseRecord) {
		return results;
	}

	return updateDb(apiRecord)
		.then(databaseRecord => [databaseRecord, apiRecord]);
})
.then(mergeRecords);

const update = article => cacheDel(article.uuid)
.then(() => getApi(article.uuid))
.then(apiRecord => updateDb(apiRecord)
	.then(databaseRecord => [databaseRecord, apiRecord])
	.then(mergeRecords)
);

module.exports = {
	getApi,
	get,
	update,
	modes,
	getCanonical,
};
