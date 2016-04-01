'use strict';

const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const path = require('path');
const denodeify = require('denodeify');
const database = require('../lib/database');
const ftApi = require('../lib/ftApi');
const fbApi = require('../lib/fbApi');
const uuidRegex = require('../lib/uuid');

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
		article.fbRecords[item.mode].imports = article.fbRecords[item.mode].imports || [];
		article.fbRecords[item.mode].imports.push(item);
	});

	return article;
};

const get = key => new Promise(resolve => {
	const uuid = (uuidRegex.exec(key) || [])[0];
	if(uuid) {
		return resolve(ftApi.getCanonicalFromUuid(uuid));
	}
	resolve(key);
})
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
.then(({databaseRecord, apiRecord}) => fbApi.find({canonical: databaseRecord.canonical})
	.then(fbRecords => {
		const promises = databaseRecord.import_meta.map(item => fbApi.get({type: 'import', id: item.id, fields: ['id', 'errors', 'status']}));
		return Promise.all(promises)
			.then(fbImports => ({databaseRecord, apiRecord, fbRecords, fbImports}));
	})
)
.then(mergeRecords);

const update = article => cacheDel(article.canonical)
.then(() => getApi(article.canonical))
.then(apiRecord => (article.apiRecord = apiRecord))
.then(() => updateDb(article))
.then(() => get(article.canonical));

const setImportStatus = (article, mode, id) => {
	article.import_meta.unshift({
		timestamp: Date.now(),
		mode,
		id,
	});
	return updateDb(article)
		.then(() => get(article.canonical));
};

module.exports = {
	getApi,
	get,
	update,
	setImportStatus,
};
