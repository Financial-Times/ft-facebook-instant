'use strict';

const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const path = require('path');
const denodeify = require('denodeify');
const database = require('../lib/database');
const fbApi = require('../lib/fbApi');
const fetch = require('node-fetch');
const url = require('url');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';

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

const setDb = apiRecord => getCanonical(apiRecord.id)
.then(canonical => database.set({
	canonical,
	uuid: apiRecord.id,
	title: apiRecord.title,
	date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
	date_record_updated: Date.now(),
	imports: [],
}))
.then(() => database.get(apiRecord.id));

const updateDb = article => database.set({
	canonical: article.canonical,
	uuid: article.uuid,
	title: article.apiRecord.title,
	date_editorially_published: new Date(article.apiRecord.publishedDate).getTime(),
	date_record_updated: Date.now(),
	imports: article.imports || [],
});

const mergeRecords = ({databaseRecord, apiRecord, fbRecords, fbImports}) => {
	const article = {};
	Object.keys(databaseRecord).forEach(key => (article[key] = databaseRecord[key]));

	article.apiRecord = apiRecord;
	article.fbRecords = fbRecords;

	(fbImports || []).forEach(item => {
		const dbImportIndex = article.imports.findIndex(record => record.importId === item.id);
		if(dbImportIndex >= 0) {
			article.imports[dbImportIndex] = Object.assign(article.imports[dbImportIndex], item);
		} else {
			article.imports.push(item);
		}
	});

	return article;
};

const get = uuid => Promise.all([
	database.get(uuid),
	getApi(uuid),
])
.then(([databaseRecord, apiRecord]) => {
	if(databaseRecord) {
		return {databaseRecord, apiRecord};
	}

	return setDb(apiRecord)
		.then(newDatabaseRecord => ({databaseRecord: newDatabaseRecord, apiRecord}));
})
.then(({databaseRecord, apiRecord}) => fbApi.find({canonical: databaseRecord.canonical})
	.then(fbRecords => {
		const promises = databaseRecord.imports.map(item => fbApi.get({type: 'import', id: item.importId, fields: ['id', 'errors', 'status']}));
		return Promise.all(promises)
			.then(fbImports => ({databaseRecord, apiRecord, fbRecords, fbImports}));
	})
)
.then(mergeRecords);

const update = article => cacheDel(article.uuid)
.then(() => getApi(article.uuid))
.then(apiRecord => (article.apiRecord = apiRecord))
.then(() => updateDb(article))
.then(() => get(article.uuid));

const setImportStatus = (article, importId) => {
	article.imports.unshift({
		timestamp: Date.now(),
		importId,
	});
	return updateDb(article)
		.then(() => get(article.uuid));
};

module.exports = {
	getApi,
	get,
	update,
	getCanonical,
	setImportStatus,
};
