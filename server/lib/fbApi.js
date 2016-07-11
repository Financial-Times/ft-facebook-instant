'use strict';

const denodeify = require('denodeify');
const Facebook = require('fb');
const api = denodeify(Facebook.napi);
const fetchres = require('fetchres');
const retry = require('./retry');

const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
const pageId = process.env.FB_PAGE_ID;
const mode = require('./mode').get();
const accessTokens = require('./accessTokens');
const FbApiImportException = require('./fbApi/importException');
const FbApiTimeoutException = require('./fbApi/timeoutException');
const ravenClient = require('./raven');

const BATCH_SIZE = 50;

// See introspect()
const defaultFields = {

	article: [
		'id',
		'canonical_url',
		'development_mode',
		'most_recent_import_status',
		'published',
		// 'photos',
		// 'videos',
		// 'html_source',
	],

	import: [
		'id',
		'errors',
		'status',
		// 'html_source',
		// 'instant_article',
	],

	related: [],
};

const MAX_IMPORT_WAIT = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const STRING_LIMIT = 500;

Facebook.options({
	version: 'v2.5',
	accessToken,
	timeout: (mode === 'production' ? 10000 : 30000),
});

function addAccessToken(params) {
	let options = {};
	if(typeof params[params.length - 1] === 'object') {
		options = params.pop();
	}

	if(options.access_token) {
		return Promise.resolve([...params, options]);
	} else {
		return accessTokens.get().then(newAccessToken => {
			options.access_token = newAccessToken;
			return [...params, options];
		});
	}
}

const parseBatchResult = result => {
	try{
		return JSON.parse(result.body);
	} catch(e) {
		throw Error(`Failed to parse JSON from result: ${e.message}`);
	}
};

const handleBatchedResults = (results, [path, verb, params], dependent, errorHandler) => Promise.resolve()
.then(() => {
	const errors = [];
	results.forEach((result, batchPart) => {
		const isDependent = dependent[batchPart];

		// Null results which are not dependent on a previous result are probably
		// timeouts, so retry the whole batch. Ideally, we'd retry only the failing batch
		// parts here.
		if(result === null && !isDependent) {
			throw new FbApiTimeoutException();
		}

		let parsed;
		try{
			parsed = parseBatchResult(result);
		} catch(e) {
			return errors.push({
				result,
				batchPart,
				error: e.toString(),
			});
		}

		const status = result.code;
		if(status === 400 && isDependent && parsed && parsed.error && parsed.error.message === 'Cannot specify an empty identifier') {
			// This result, which depended on the previous one, is complaining that the
			// JSONPath identifier in the request doesn't match the data returned by the
			// previous result. Verify the data from the previous result is OK, replacing
			// this result with a more appropriate alternative if it's not actually an
			// error state.
			try{
				const replacement = errorHandler({previousResult: results[batchPart - 1], batchPart});
				results[batchPart] = replacement;
				return;
			} catch(e) {
				return errors.push({
					result,
					batchPart,
					previousResult: results[batchPart - 1],
					error: e.toString(),
				});
			}
		}

		if(status !== 200) {
			return errors.push({
				result,
				batchPart,
				error: parsed && parsed.error,
			});
		}

		results[batchPart] = parsed;
	});

	if(errors.length) {
		throw Error(`Batch failed with ${errors.length} error(s): ${JSON.stringify(errors)}`);
	}

	return results;
});

const handlePagedResult = (result, limit) => Promise.resolve()
.then(() => {
	if(limit && result.data && result.data.length >= limit) {
		result.data = result.data.slice(0, limit);
		return result;
	}

	if(!result.paging || !result.paging.next) return result;

	// TODO: Why do these 'lifetime' results contain useless paging links? Is this a Graph API bug?
	if(Array.isArray(result.data) && result.data[0].period === 'lifetime') return result;

	return retry.fetch(result.paging.next, {errorFrom: 'FbApi.handlePagedResult', errorExtra: {result}})
		.then(fetchres.json)
		.then(nextResult => {
			nextResult.data = result.data.concat(nextResult.data);
			return handlePagedResult(nextResult, limit);
		});
})
.then(finalResult => {
	delete finalResult.paging;
	return finalResult;
});

const callApi = (params, {batched, dependent, limit, errorHandler, attempts = 0}) => api(...params)
.then(result => (batched ? handleBatchedResults(result, params, dependent, errorHandler) : handlePagedResult(result, limit)))
.catch(e => {
	if(e.type === 'FbApiTimeoutException' ||
		(e.name === 'FacebookApiException' && e.response && e.response.error && e.response.error.code === 'ETIMEDOUT')
		) {
		if(attempts >= MAX_ATTEMPTS) {
			throw Error('Facebook API call timed-out');
		}
		attempts++;
		console.log('Retrying timed-out Facebook call', params, {batched, dependent, limit, errorHandler, attempts});
		return callApi(params, {batched, dependent, limit, errorHandler, attempts});
	}

	if(e.name === 'FacebookApiException' && e.response && e.response.error) {
		// Rather than hash the error response object as the Exception message, use the
		// plain text message from FB
		e.message = e.response.error.message;

		ravenClient.captureException(e, {
			tags: {
				from: 'fbApi.callApi',
			},
			extra: {response: e.response, params, batched, dependent, limit, attempts},
		});
	} else {
		ravenClient.captureException(e, {
			tags: {
				from: 'fbApi.callApi',
			},
			extra: {params, batched, dependent, limit, attempts},
		});
	}

	throw e;
});

const truncate = val => {
	const ret = {};
	switch(Object.prototype.toString.call(val)) {
		case '[object Array]':
			return val.map(truncate);
		case '[object Object]':
			Object.keys(val).forEach(key => (ret[key] = truncate(val[key])));
			return ret;
		case '[object String]':
			return val.length > STRING_LIMIT ? `${val.substr(0, STRING_LIMIT)}...` : val;
		default:
			return val;
	}
};

const call = (...params) => {
	const options = params[params.length - 1];

	let limit = parseInt(options.__limit, 10);
	limit = isNaN(limit) ? 25 : limit;

	const dependent = options.__dependent;
	const batched = options.__batched;
	const errorHandler = options.__errorHandler;

	delete options.__limit;
	delete options.__dependent;
	delete options.__batched;
	delete options.__errorHandler;

	console.log(`${Date()}: FACEBOOK API: ${params.map(truncate).map(JSON.stringify).join(' ')}`);
	return addAccessToken(params)
		.then(newParams => callApi(newParams, {batched, dependent, limit, errorHandler}));
};

const chunkIdList = ids => {
	const chunks = [];
	for(let i = 0; i < ids.length; i += BATCH_SIZE) {
		chunks.push(
			ids.slice(i, i + BATCH_SIZE)
		);
	}
	return chunks;
};

const list = ({fields = [], __limit} = {}) => {
	fields = fields.length ? fields : defaultFields.article;

	return call(
		`/${pageId}/instant_articles`,
		'GET',
		{
			development_mode: (mode === 'development'),

			// Not sure what the options are here
			summary: 'total_count',

			fields: fields.join(','),

			__limit,
		}
	)
	.then(results => results.data || []);
};

const getIds = ({type = 'article', ids = [], fields = []} = {}) => {
	if(!ids.length) {
		return Promise.reject(Error('Missing required parameter [ids]'));
	}

	if(!type || !defaultFields[type]) {
		return Promise.reject(Error(`Missing or invalid type parameter: [${type}]`));
	}

	fields = fields.length ? fields : defaultFields[type];

	return call(
		'/',
		'GET',
		{
			ids: ids.join(','),
			fields: fields.join(','),
		}
	);
};

const get = ({type = 'article', id = null, fields = []}) => {
	if(!id) {
		return Promise.reject(Error('Missing required parameter [id]'));
	}

	return getIds({
		type,
		ids: [id],
		fields,
	})
	.then(result => result[id]);
};

const many = ({ids, type, fields}, fn, returnType) => Promise.all(
	chunkIdList(ids)
	.map(chunkedIds => fn({
		ids: chunkedIds,
		type,
		fields,
	}))
)
.then(chunkedResults => {
	switch(returnType) {
		case 'array':
			return chunkedResults.reduce((previous, current) => previous.concat(current), []);
		case 'object':
			return chunkedResults.reduce((previous, current) => Object.assign(previous, current), {});
		default:
			throw Error(`unrecognised returnType ${returnType}`);
	}
});

const getMany = args => many(args, getIds, 'object');

const introspect = ({id = null} = {}) => {
	if(!id) {
		return Promise.reject(Error('Missing required parameter [id]'));
	}

	return call(
		`/${id}`,
		'GET',
		{
			metadata: 1,
		}
	)
	.then(results => results.metadata);
};

const waitForSuccess = importResult => new Promise((resolve, reject) => {
	const start = Date.now();

	const loop = () => get({
		type: 'import',
		id: importResult.id,
		fields: ['id', 'errors', 'instant_article{canonical_url}', 'status'],
	})
	.then(result => {
		if(result.status === 'SUCCESS') {
			console.log(`Import ${importResult.id} successfully completed in ${(Date.now() - start) / 1000} seconds`);
			return resolve(result);
		}

		if(result.status !== 'IN_PROGRESS') {
			return reject(
				new FbApiImportException(`Unexpected import status ${result.status} for import ${importResult.id}. Errors: ${JSON.stringify(result.errors)}`)
			);
		}

		if(Date.now() > (start + MAX_IMPORT_WAIT)) {
			return reject(
				new FbApiImportException(
					`Timeout after ${MAX_IMPORT_WAIT / 60} seconds for import ${importResult.id} with status ${result.status}.` +
					`Errors: ${JSON.stringify(result.errors)}`
				)
			);
		}

		setTimeout(loop, 1000);
	});

	loop();
});

const post = ({uuid, html, published = false, wait = false} = {}) => {
	if(!uuid) {
		return Promise.reject(Error('Missing required parameter [uuid]'));
	}

	if(!html) {
		return Promise.reject(Error('Missing required parameter [html]'));
	}

	published = !!published;
	const devMode = (mode === 'development');

	console.log(`Facebook API post request: ${JSON.stringify({uuid, development_mode: devMode, published})}`);
	return call(
		`/${pageId}/instant_articles`,
		'POST',
		{
			published,
			development_mode: devMode,
			html_source: html,
		}
	)
	.then(result => (wait ? waitForSuccess(result) : result))
	.then(result => (console.log(`Facebook API post result: ${JSON.stringify({uuid, development_mode: devMode, published, result})}`), result))
	.catch(e => {
		if(e.type === 'FbApiImportException') {
			throw Error(`Import error encountered posting UUID ${uuid} to Facebook: ${e.message}`);
		}
		throw e;
	});
};

const findbyCanonical = ({ids = [], fields = []} = {}) => {
	if(!ids.length) {
		return Promise.reject(Error('Missing required parameter [ids]'));
	}

	fields = fields.length ? fields : defaultFields.article;

	const key = (mode === 'production') ? 'instant_article' : 'development_instant_article';

	return call(
		'/',
		'GET',
		{
			fields: `${key}{${fields.join(',')}}`,
			ids: ids.join(','),
		}
	)
	.then(result => {
		ids.forEach(canonical => {
			const ret = {};
			ret[mode] = result[canonical][key] || {nullRecord: true};
			result[canonical] = ret;
		});
		return result;
	});
};

const find = ({canonical = null, fields = []}) => {
	if(!canonical) {
		return Promise.reject(Error('Missing required parameter [canonical]'));
	}

	return findbyCanonical({
		type: 'article',
		ids: [canonical],
		fields,
	})
	.then(result => result[canonical]);
};

const findMany = args => many(args, findbyCanonical, 'object');

const del = ({canonical = null} = {}) => {
	if(!canonical) {
		return Promise.reject(Error('Missing required parameter [id]'));
	}

	return find({canonical})
		.then(results => results[mode])
		.then(result => result && result.id && call(
			`/${result.id}`,
			'DELETE',
			{}
		));
};

const wipe = () => list({fields: ['id']})
.then(items => Promise.all(items.map(item => del({id: item.id}))));

module.exports = {
	list,
	many,
	get,
	getMany,
	introspect,
	post,
	delete: del,
	find,
	findMany,
	wipe,
	call,
};
