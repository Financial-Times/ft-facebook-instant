'use strict';

const fetch = require('node-fetch');
const database = require('../lib/database');
const ftApi = require('../lib/ftApi');
const fbApi = require('../lib/fbApi');
const uuidRegex = require('../lib/uuid');
const diskCache = require('../lib/diskCache');

const mode = require('../lib/mode').get();

const getApi = canonical => diskCache.articles.get(canonical)
.then(cached => {
	if(cached) {
		return cached;
	}

	return ftApi.fetchByCanonical(canonical)
		.then(article => article || Promise.reject(Error(`Canonical URL [${canonical}] is not in Elastic Search`)))
		.then(article => diskCache.articles.set(canonical, article));
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

	const importMeta = article.import_meta
		.filter(item => item.mode === mode);
	let imports = [];

	fbImports.forEach(item => {
		const dbImportIndex = importMeta.findIndex(record => record.id === item.id);

		let merged;
		if(dbImportIndex >= 0) {
			merged = Object.assign({}, importMeta.splice(dbImportIndex, 1)[0], item);
		} else {
			merged = item;
		}

		merged.messages = flattenErrors(merged.errors);
		delete merged.errors;

		imports.push(merged);
	});

	// Add any remaining import meta which isn't reflected on the FB API
	imports = imports.concat(importMeta)
		.sort((a, b) => b.timestamp - a.timestamp);

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

const getCanonical = key => diskCache.canonical.get(`canonical:${key}`)
.then(cached => {
	if(cached) {
		return cached;
	}

	return deriveCanonical(key)
		.then(canonical => diskCache.canonical.set(`canonical:${key}`, canonical));
});

const addFbData = ({databaseRecord, apiRecord}) => fbApi.find({canonical: databaseRecord.canonical})
.then(fbRecords => {
	const promises = databaseRecord.import_meta
		.filter(item => item.mode === mode)
		.filter(item => !!item.id)
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

// TODO: also purge slideshow assets which belong to this UUID? Or cache slideshow asset
// contents as part of the article JSON?
const update = article => Promise.all([
	diskCache.articles.del(article.canonical),
	ftApi.updateEs(article.uuid),
])
.then(() => getApi(article.canonical))
.then(apiRecord => (article.apiRecord = apiRecord))
.then(() => updateDb(article))
.then(() => get(article.canonical));

const setImportStatus = ({article, id = null, warnings = [], type = 'unknown'}) => {
	article.import_meta.unshift({
		timestamp: Date.now(),
		mode,
		id,
		type,
		appVersion: process.env.HEROKU_RELEASE_VERSION,
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
	getCanonical,
};
