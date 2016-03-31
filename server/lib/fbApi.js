'use strict';

const denodeify = require('denodeify');
const Facebook = require('fb');
const api = denodeify(Facebook.napi);

const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
const pageId = process.env.FB_PAGE_ID;

// See introspect()
const defaultFields = {

	// Also available: html_source
	article: [
		'id',
		'canonical_url',
		'development_mode',
		'most_recent_import_status',
		'photos',
		'published',
		'videos',
	],

	import: [
		'id',
		'errors',
		'html_source',
		'instant_article',
		'status',
	],
};

Facebook.options({
	version: 'v2.5',
	accessToken,
});

const listMode = ({mode = 'development', fields = []} = {}) => {
	fields = fields.concat(defaultFields.article);

	return api(
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

const list = ({fields = []} = {}) => Promise.all([
	listMode({mode: 'development', fields}),
	listMode({mode: 'production', fields}),
])
.then(([development, production]) => ({development, production}));

const get = ({type = 'article', id = null, fields = []} = {}) => {
	if(!id) {
		throw Error('Missing required parameter [id]');
	}

	if(!type || !defaultFields[type]) {
		throw Error(`Missing or invalid type parameter: [${type}]`);
	}

	fields = fields.concat(defaultFields[type]);

	return api(
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

	return api(
		`/${id}`,
		'GET',
		{
			metadata: 1,
		}
	)
	.then(results => results.metadata);
};

const post = ({mode = 'development', published = false, html = ''} = {}) => {
	if(!html) {
		throw Error('Missing required parameter [html]');
	}

	return api(
		`/${pageId}/instant_articles`,
		'POST',
		{
			development_mode: (mode === 'development'),
			published: !!published,
			html_source: html,
		}
	);
};

const del = ({id = null} = {}) => {
	if(!id) {
		throw Error('Missing required parameter [id]');
	}

	return api(
		`/${id}`,
		'DELETE',
		{}
	)
	.then(result => Object.assign(result, {id}));
};

const find = ({canonical = null} = {}) => {
	if(!canonical) {
		throw Error('Missing required parameter [canonical]');
	}

	return api(
		'/',
		'GET',
		{
			id: canonical,
			fields: 'instant_article,development_instant_article{id}',
		}
	)
	.then(results => {
		const promises = [];

		if(results.development_instant_article) {
			promises.push(get({id: results.development_instant_article.id}));
		}

		if(results.instant_article) {
			promises.push(get({id: results.instant_article.id}));
		}

		return Promise.all(promises);
	})
	.then(items => {
		const results = {
			development: [],
			production: [],
		};
		items.forEach(item => (item.development_mode ? results.development.push(item) : results.production.push(item)));

		return results;
	});
};

const wipe = () => list()
.then(({development, production}) => Promise.all(development.concat(production).map(item => del({id: item.id}))));

module.exports = {
	list,
	get,
	introspect,
	post,
	delete: del,
	find,
	wipe,
};
