'use strict';

const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const path = require('path');
const denodeify = require('denodeify');
const fetch = require('node-fetch');
const database = require('../lib/database');
const ftApi = require('../lib/ftApi');
const fbApi = require('../lib/fbApi');
const uuidRegex = require('../lib/uuid');

const mode = require('../lib/mode').get();

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

const getApi = canonical => cacheGet(canonical)
.then(cached => {
	if(cached) {
		return cached;
	}

	return ftApi.fetchByCanonical(canonical)
		.then(article => article || Promise.reject(Error(`Canonical URL [${canonical}] is not in Elastic Search`)))
		.then(article => cacheSet(canonical, article));
});

const setDb = apiRecord => database.set({
	canonical: apiRecord.webUrl,
	uuid: apiRecord.id,
	title: apiRecord.title,
	date_editorially_published: new Date(apiRecord.publishedDate).getTime(),
	date_record_updated: Date.now(),
	import_meta: [],
})
.then(() => database.get(apiRecord.webUrl));

const updateDb = article => database.set({
	canonical: article.canonical,
	uuid: article.uuid,
	title: article.apiRecord.title,
	date_editorially_published: new Date(article.apiRecord.publishedDate).getTime(),
	date_record_updated: Date.now(),
	import_meta: article.import_meta || [],
});

const flattenErrors = (items = []) => {
	const errors = {};

	items.forEach(item => {
		if(!errors[item.level]) errors[item.level] = [];
		if(errors[item.level].indexOf(item.message) === -1) {
			errors[item.level].push(item.message);
		}
	});

	return errors;
};

const mergeRecords = ({databaseRecord, apiRecord, fbRecords, fbImports = []}) => {
	const article = Object.assign({}, databaseRecord);

	if(apiRecord) {
		article.apiRecord = apiRecord;
	}
	article.fbRecords = fbRecords;

	const imports = [];

	fbImports.forEach(item => {
		const dbImportIndex = article.import_meta.findIndex(record => record.id === item.id);
		const merged = (dbImportIndex >= 0) ? Object.assign({}, article.import_meta[dbImportIndex], item) : item;

		merged.messages = flattenErrors(merged.errors);
		delete merged.errors;

		imports.push(merged);
	});

	imports.forEach(item => {
		if(article.fbRecords[item.mode]) {
			article.fbRecords[item.mode].imports = article.fbRecords[item.mode].imports || [];
			article.fbRecords[item.mode].imports.push(item);
		}
	});

	return article;
};

const extractUuid = string => (uuidRegex.exec(string) || [])[0];

// Follow redirects first
const deriveCanonical = key => {
	let uuid = extractUuid(key);
	if(uuid) {
		return ftApi.getCanonicalFromUuid(uuid);
	}

	return fetch(key)
	.then(res => {
		uuid = extractUuid(res.url);
		if(uuid) {
			return ftApi.getCanonicalFromUuid(uuid);
		}
		return ftApi.verifyCanonical(key)
			.then(canonical => canonical || Promise.reject(Error(`Canonical URL [${key}] is not in Elastic Search`)));
	});
};

const getCanonical = key => cacheGet(`canonical:${key}`)
.then(cached => {
	if(cached) {
		return cached;
	}

	return deriveCanonical(key)
		.then(canonical => cacheSet(`canonical:${key}`, canonical));
});

const addFbData = ({databaseRecord, apiRecord}) => fbApi.find({canonical: databaseRecord.canonical})
.then(fbRecords => {
	const promises = databaseRecord.import_meta
		.filter(item => item.mode === mode)
		.map(item => fbApi.get({type: 'import', id: item.id, fields: ['id', 'errors', 'status']})
			.catch(() => {
				// Ignore db records which don't map to existing FB records
			})
		);
	return Promise.all(promises)
		.then(fbImports => fbImports.filter(record => record !== undefined))
		.then(fbImports => ({databaseRecord, apiRecord, fbRecords, fbImports}));
})
.then(mergeRecords);

const get = key => getCanonical(key)
.then(canonical => Promise.all([
	database.get(canonical),
	getApi(canonical),
]))
.then(([databaseRecord, apiRecord]) => {
	if(databaseRecord) {
		return {databaseRecord, apiRecord};
	}

	return setDb(apiRecord)
		.then(newDatabaseRecord => ({databaseRecord: newDatabaseRecord, apiRecord}));
})
.then(({databaseRecord, apiRecord}) => addFbData({databaseRecord, apiRecord}));

const ensureInDb = key => getCanonical(key)
.then(canonical => database.get(canonical)
	.then(databaseRecord => databaseRecord || getApi(canonical)
		.then(apiRecord => setDb(apiRecord))
	)
);

const update = article => cacheDel(article.canonical)
.then(() => getApi(article.canonical))
.then(apiRecord => (article.apiRecord = apiRecord))
.then(() => updateDb(article))
.then(() => get(article.canonical));

const setImportStatus = ({article, id, warnings, type = 'unknown'}) => {
	article.import_meta.unshift({
		timestamp: Date.now(),
		mode,
		id,
		type,
		warnings,
	});
	return updateDb(article)
		.then(() => get(article.canonical));
};

module.exports = {
	getApi,
	get,
	update,
	setImportStatus,
	ensureInDb,
};
