'use strict';

const denodeify = require('denodeify');
const Facebook = require('fb');
const api = denodeify(Facebook.napi);

const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
const pageId = process.env.FB_PAGE_ID;
const mode = require('./mode').get();

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

const call = (...params) => api.apply(null, params)
.catch(e => {
	if(e.name === 'FacebookApiException' &&
		e.response &&
		e.response.error &&
		e.response.error.code === 'ETIMEDOUT') {
		throw Error('Facebook API call timed-out');
	}
	throw e;
});

const list = ({fields = []} = {}) => {
	fields = fields.length ? fields : defaultFields.article;

	return call(
		`/${pageId}/instant_articles`,
		'GET',
		{
			development_mode: (mode === 'development'),

			// Not sure what the options are here
			summary: 'total_count',

			fields: fields.join(','),
		}
	)
	.then(results => results.data || []);
};

const get = ({type = 'article', id = null, fields = []} = {}) => {
	if(!id) {
		throw Error('Missing required parameter [id]');
	}

	if(!type || !defaultFields[type]) {
		throw Error(`Missing or invalid type parameter: [${type}]`);
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
		throw Error('Missing required parameter [id]');
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

const post = ({published = false, html = ''} = {}) => {
	if(!html) {
		throw Error('Missing required parameter [html]');
	}

	return call(
		`/${pageId}/instant_articles`,
		'POST',
		{
			development_mode: (mode === 'development'),
			published: !!published,
			html_source: html,
		}
	);
};

const find = ({canonical = null} = {}) => {
	if(!canonical) {
		throw Error('Missing required parameter [canonical]');
	}

	const fields = (mode === 'production') ? 'instant_article' : 'development_instant_article{id}';

	return call(
		'/',
		'GET',
		{
			id: canonical,
			fields,
		}
	)
	.then(results => {
		const key = (mode === 'production') ? 'instant_article' : 'development_instant_article';
		if(!results[key]) {
			return {nullRecord: true};
		}
		return get({id: results[key].id});
	})
	.then(item => {
		const results = {};
		results[mode] = item;
		return results;
	});
};

const del = ({canonical = null} = {}) => {
	if(!canonical) {
		throw Error('Missing required parameter [id]');
	}

	return find({canonical})
		.then(results => results[mode])
		.then(result => result && call(
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
};
