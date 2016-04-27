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

Facebook.options({
	version: 'v2.5',
	accessToken,
	timeout: (mode === 'production' ? 2000 : 10000),
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

const call = (...params) => addAccessToken(params)
.then(newParams => {
	const options = newParams[newParams.length - 1];

	let limit = parseInt(options.__limit, 10);
	limit = isNaN(limit) ? 25 : limit;

	delete options.__limit;

	return api(...newParams)
		.then(result => handlePagedResult(result, limit))
		.catch(e => {
			if(e.name === 'FacebookApiException' &&
				e.response &&
				e.response.error &&
				e.response.error.code === 'ETIMEDOUT') {
				throw Error('Facebook API call timed-out');
			}
			throw e;
		});
});

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

const post = ({uuid, html, published = false} = {}) => {
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
	.then(result => (console.log(`Facebook API post result: ${JSON.stringify({uuid, development_mode: devMode, published, result})}`), result));
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
		if(result[key]) {
			ret[mode] = result[key] || {nullRecord: true};
		}
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
