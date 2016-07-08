'use strict';

/* eslint-disable no-use-before-define */

const database = require('../lib/database');
const ftApi = require('../lib/ftApi');
const fbApi = require('../lib/fbApi');
const uuidRegex = require('../lib/uuid');
const {version} = require('../../package.json');
const retry = require('../lib/retry');

const mode = require('../lib/mode').get();

// TODO: also purge slideshow assets which belong to this UUID? Or cache slideshow asset
// contents as part of the article JSON?
const clearCache = canonical => database.purgeCapi(canonical);

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
			merged = Object.assign({mode, timestamp: 0}, item);
		}

		merged.messages = flattenErrors(merged.errors);
		delete merged.errors;

		imports.push(merged);
	});

	// Add any remaining import meta which isn't reflected on the FB API
	imports = imports.concat(importMeta)
		.sort((a, b) => (a.timestamp ? (b.timestamp - a.timestamp) : Number.POSITIVE_INFINITY));

	imports.forEach(item => {
		if(article.fbRecords[item.mode]) {
			article.fbRecords[item.mode].imports = article.fbRecords[item.mode].imports || [];
			article.fbRecords[item.mode].imports.push(item);
		}
	});

	const initialImport = imports.filter(item => (
		item.type === 'ui' &&
		item.status === 'SUCCESS' &&
		item.published === (process.env.NODE_ENV === 'production')
	)).pop();

	if(initialImport && article.fbRecords[initialImport.mode]) {
		article.fbRecords[initialImport.mode].initialImport = initialImport;
	}

	return updateDb(article)
		.then(() => article);
};

const extractUuid = string => (uuidRegex.exec(string) || [])[0];

const resolveUrl = url => retry.fetch(url, {errorFrom: 'articles.resolveUrl', errorExtra: {url}})
.then(res => res.url);

// Follow redirects first
const deriveCanonical = key => {
	let uuid = extractUuid(key);
	if(uuid) {
		return ftApi.getCanonicalFromUuid(uuid);
	}

	return resolveUrl(key)
	.then(resolved => {
		uuid = extractUuid(resolved);
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

const getFbImportsForLookup = ({databaseRecord, fbRecords}) => {
	const imports = databaseRecord.import_meta
		.filter(item => item.mode === mode)
		.filter(item => !!item.id);

	if(fbRecords[mode].most_recent_import_status && !imports.find(item => item.id === fbRecords[mode].most_recent_import_status.id)) {
		imports.unshift(fbRecords[mode].most_recent_import_status);
	}

	return imports.map(item => item.id);
};

const addFbImports = articles => {
	const importIdsMap = new Map();
	let importIds = [];
	articles.forEach(article => {
		const ids = getFbImportsForLookup(article);
		importIds = importIds.concat(ids);
		importIdsMap.set(article, ids);
	});

	return fbApi.getMany({ids: importIds, type: 'import', fields: ['id', 'errors', 'status']})
	.then(imports => articles.map(article => {
		article.fbImports = importIdsMap.get(article)
			.map(importId => imports[importId])
			.filter(item => !!item);
		return article;
	}));
};

const addFbImportsScalar = article => addFbImports([article])
.then(articles => articles[0]);

const setImportStatus = ({article, id = null, warnings = [], type = 'unknown', username = 'unknown', published = false}) => {
	// TODO: fix this condition, remove debugging
	if(!Array.isArray(article.import_meta)) {
		console.log(
			'setImportStatus Error. Invalid `article.import_meta` for article:',
			{article, id, warnings, type, username, published},
			Error().stack
		);
	}

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
		appVersion: version,
		env: process.env.NODE_ENV,
		warnings,
		username,
		published,
	});
	return updateDb(article)
		.then(() => get(article.canonical));
};

const removeFromFacebook = (canonical, type = 'article-model') => fbApi.delete({canonical})
.then(() => database.get(canonical))
.then(article => setImportStatus({article, type, username: 'system'}))
.then(() => console.log(`${Date()}: Article model: Removed article from Facebook: ${canonical}`));

const getApi = canonical => database.getCapi(canonical)
.then(cached => {
	if(cached) {
		return cached;
	}

	return ftApi.fetchByCanonical(canonical)

		// Only set in cache if bodyHTML is set (otherwise no point, and prevents
		// automatically fetching better content)
		.then(article => (article.bodyHTML && database.setCapi(canonical, article), article))

		// Content is not available in ES, so ensure deleted from FB before rethrowing
		.catch(e => {
			if(e.type === 'FtApiContentMissingException') {
				console.log(`Canonical ${canonical} is not available in ES, so deleting any existing FB record.`);
				return removeFromFacebook(canonical, 'article-model-get-api')
				.then(() => {
					throw e;
				});
			}
			throw e;
		});
});

const getOwnData = key => getCanonical(key)
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
});

const get = key => getOwnData(key)
.then(({databaseRecord, apiRecord}) =>
	fbApi.find({canonical: databaseRecord.canonical})
		.then(fbRecords => ({databaseRecord, apiRecord, fbRecords}))
		.then(addFbImportsScalar)
		.then(mergeRecords)
);

// TODO: also purge slideshow assets which belong to this UUID? Or cache slideshow asset
// contents as part of the article JSON?
const update = article => Promise.all([
	clearCache(article.canonical),
	ftApi.updateEs(article.uuid),
])
.then(() => getApi(article.canonical))
.then(apiRecord => (article.apiRecord = apiRecord))
.then(() => {
	article.date_record_updated = Date.now();
	return updateDb(article);
})
.then(() => get(article.canonical));

const getOwnDataList = canonicals => Promise.all(canonicals.map(
	canonical => getOwnData(canonical)
		.catch(e => {
			if(e.type === 'FtApiContentMissingException') {
				console.log(`Canonical ${canonical} is not available in ES, so deleting any existing FB record.`);
				return removeFromFacebook(canonical, 'article-model-get-list');
			}
			throw e;
		})
))
.then(articles => articles.filter(article => !!article));

const getList = canonicals => getOwnDataList(canonicals)
.then(ownDataList =>
	fbApi.findMany({
		type: 'article',
		ids: ownDataList.map(article => article.databaseRecord.canonical),
	})
	.then(fbDataList =>
		ownDataList.map(article => {
			article.fbRecords = fbDataList[article.databaseRecord.canonical];
			return article;
		})
	)
	.then(articles => addFbImports(articles))
	.then(articles => Promise.all(
		articles.map(mergeRecords)
	))
);

module.exports = {
	getApi,
	get,
	getList,
	update,
	clearCache,
	setImportStatus,
	getCanonical,
	resolveUrl,
	removeFromFacebook,
};
