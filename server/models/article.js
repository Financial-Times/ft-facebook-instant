'use strict';

const fetch = require('node-fetch');
const database = require('../lib/database');
const ftApi = require('../lib/ftApi');
const fbApi = require('../lib/fbApi');
const uuidRegex = require('../lib/uuid');
const diskCache = require('../lib/diskCache');

const mode = require('../lib/mode').get();

// TODO: also purge slideshow assets which belong to this UUID? Or cache slideshow asset
// contents as part of the article JSON?
const clearCache = article => diskCache.articles.del(article.canonical);

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
	title: article.apiRecord ? article.apiRecord.title : article.title,
	date_editorially_published: article.apiRecord ? new Date(article.apiRecord.publishedDate).getTime() : article.date_editorially_published,
	date_record_updated: article.date_record_updated,
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
			// Add the FB data to the DB record, to be saved later
			merged = Object.assign(importMeta.splice(dbImportIndex, 1)[0], item);
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

	return updateDb(article)
		.then(() => article);
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
		return ftApi.verifyCanonical(key);
	});
};

const getCanonical = key => database.getCanonical(key)
.then(cached => {
	if(cached) {
		return cached;
	}

	return deriveCanonical(key)
		.then(canonical => database.setCanonical(key, canonical));
});

const addFbData = ({databaseRecord, apiRecord}) => fbApi.find({canonical: databaseRecord.canonical})
.then(fbRecords => {
	const promises = databaseRecord.import_meta
		.filter(item => item.mode === mode)
		.filter(item => !!item.id)
		.map(item => fbApi.get({type: 'import', id: item.id, fields: ['id', 'errors', 'status']})
			.catch(e => {
				if(e.name === 'FacebookApiException' && e.response && e.response.error.type === 'GraphMethodException') {
					// This import will never be resolveable, so delete it
					delete item.id;
					return;
				}
				throw e;
			})
		);
	return Promise.all(promises)
		.then(fbImports => fbImports.filter(record => record !== undefined))
		.then(fbImports => ({databaseRecord, apiRecord, fbRecords, fbImports}));
})
.then(mergeRecords);

const setImportStatus = ({article, id = null, warnings = [], type = 'unknown', username = 'unknown', published = 'false'}) => {
	// Delete FB ids from all previous imports
	article.import_meta = article.import_meta.map(item => {
		delete item.id;
		return item;
	});

	article.import_meta.unshift({
		timestamp: Date.now(),
		mode,
		id,
		type,
		appVersion: process.env.HEROKU_RELEASE_VERSION,
		env: process.env.NODE_ENV,
		warnings,
		username,
		published,
	});
	return updateDb(article)
		.then(() => addFbData({databaseRecord: article, apiRecord: article.apiRecord}));
};

const removeFromFacebook = (canonical, type = 'article-model') => fbApi.delete({canonical})
.then(() => database.get(canonical))
.then(article => setImportStatus({article, type, username: 'system'}))
.then(() => console.log(`${Date()}: Article model: Removed article from Facebook: ${canonical}`));

const getApi = canonical => diskCache.articles.get(canonical)
.then(cached => {
	if(cached) {
		return cached;
	}

	return ftApi.fetchByCanonical(canonical)

		// Only set in cache if bodyHTML is set (otherwise no point, and prevents
		// automatically fetching better content)
		.then(article => (article.bodyHTML && diskCache.articles.set(canonical, article), article))

		// Content is not available in ES, so ensure deleted from FB before rethrowing
		.catch(e => {
			if(e.type === 'FtApiContentMissingException') {
				return removeFromFacebook(canonical, 'article-model-get-api')
				.then(() => {
					throw e;
				});
			}
			throw e;
		});
});

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

// TODO: also purge slideshow assets which belong to this UUID? Or cache slideshow asset
// contents as part of the article JSON?
const update = article => Promise.all([
	diskCache.articles.del(article.canonical),
	ftApi.updateEs(article.uuid),
])
.then(() => getApi(article.canonical))
.then(apiRecord => (article.apiRecord = apiRecord))
.then(() => {
	article.date_record_updated = Date.now();
	return updateDb(article);
})
.then(() => get(article.canonical));

const getList = canonicals => Promise.all(canonicals.map(
	canonical => get(canonical)
		.catch(e => {
			if(e.type === 'FtApiContentMissingException') {
				return removeFromFacebook(canonical, 'article-model-get-list');
			}
			throw e;
		})
))
.then(articles => articles.filter(article => !!article));

module.exports = {
	getApi,
	get,
	getList,
	update,
	clearCache,
	setImportStatus,
	getCanonical,
	removeFromFacebook,
};
