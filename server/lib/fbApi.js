'use strict';

const denodeify = require('denodeify');
const Facebook = require('fb');
const api = denodeify(Facebook.napi);
const nodeFetch = require('node-fetch');
const fetchres = require('fetchres');

const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
const pageId = process.env.FB_PAGE_ID;
const mode = require('./mode').get();
const accessTokens = require('./accessTokens');
const FbApiImportException = require('./fbApi/importException');
const FbApiTimeoutException = require('./fbApi/timeoutException');

// See introspect()
const defaultFields = {

	article: [
		'id',
		'canonical_url',
		'development_mode',
		'most_recent_import_status',
		'photos',
		'published',
		'videos',
		'html_source',
	],

	import: [
		'id',
		'errors',
		'html_source',
		'instant_article',
		'status',
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

const handlePagedResult = (result, limit) => Promise.resolve()
.then(() => {
	if(limit && result.data && result.data.length >= limit) {
		result.data = result.data.slice(0, limit);
		return result;
	}

	if(!result.paging || !result.paging.next) return result;

	// TODO: Why do these 'lifetime' results contain useless paging links? Is this a Graph API bug?
	if(Array.isArray(result.data) && result.data[0].period === 'lifetime') return result;

	return nodeFetch(result.paging.next)
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

const parseBatchResult = result => {
	try{
		return JSON.parse(result.body);
	} catch(e) {
		throw Error(`Failed to parse JSON from result: ${result}`);
	}
};

const handleBatchedResults = (results, params, dependent) => Promise.resolve()
.then(() => {
	const statuses = results.map((result, index) => (result.code === 200 ? 'ok' : {result, query: params.batch[index]}));
	const errors = results.filter(result => (result.code !== 200));
	const nulls = results.filter(result => (result === null));

	if(errors.length) {
		throw Error(`Batch failed with ${errors.length} error(s). Results: ${JSON.stringify(statuses)}. Params: ${JSON.stringify(params)}`);
	}

	if(nulls.length) {
		// Null batch responses where there are no errors are probably timeouts, so retry the
		// whole batch. Ideally, we'd retry only the failing batch parts here.
		throw new FbApiTimeoutException();
	}

	return results.map(parseBatchResult);
});

const callApi = (params, {batched, dependent, limit, attempts = 0}) => api(...params)
.then(result => (batched ? handleBatchedResults(result, params, dependent) : handlePagedResult(result, limit)))
.catch(e => {
	if(e.type === 'FbApiTimeoutException' ||
		(e.name === 'FacebookApiException' && e.response && e.response.error && e.response.error.code === 'ETIMEDOUT')
		) {
		if(attempts >= MAX_ATTEMPTS) {
			throw Error('Facebook API call timed-out');
		}
		attempts++;
		console.log('Retrying timed-out Facebook call', params, {batched, dependent, limit, attempts});
		return callApi(params, {batched, dependent, limit, attempts});
	}

	if(e.name === 'FacebookApiException' && e.response) {
		e.response.fbtrace_id = undefined; // ensure consistent message for sentry aggregation
		throw new Facebook.FacebookApiException(e.response);
	}

	throw e;
});

const truncate = val => {
	const ret = {};
	switch(typeof val) {
		case 'object':
			Object.keys(val).forEach(key => (ret[key] = truncate(val[key])));
			return ret;
		case 'string':
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

	delete options.__limit;
	delete options.__dependent;
	delete options.__batched;

	console.log(`${Date()}: FACEBOOK API: ${params.map(truncate).map(JSON.stringify).join(' ')}`);
	return addAccessToken(params)
		.then(newParams => callApi(newParams, {batched, dependent, limit}));
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

const get = ({type = 'article', id = null, fields = []} = {}) => {
	if(!id) {
		return Promise.reject(Error('Missing required parameter [id]'));
	}

	if(!type || !defaultFields[type]) {
		return Promise.reject(Error(`Missing or invalid type parameter: [${type}]`));
	}

	fields = fields.length ? fields : defaultFields[type];

	return call(
		`/${id}`,
		'GET',
		{
			fields: fields.join(','),
		}
	);
};

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

const find = ({canonical = null, fields = []} = {}) => {
	if(!canonical) {
		return Promise.reject(Error('Missing required parameter [canonical]'));
	}

	fields = fields.length ? fields : defaultFields.article;
	const key = (mode === 'production') ? 'instant_article' : 'development_instant_article';

	return call(
		`/${canonical}`,
		'GET',
		{
			fields: `${key}{${fields.join(',')}}`,
		}
	)
	.then(result => {
		const ret = {};
		ret[mode] = result[key] || {nullRecord: true};
		return ret;
	});
};

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
	get,
	introspect,
	post,
	delete: del,
	find,
	wipe,
	call,
};
