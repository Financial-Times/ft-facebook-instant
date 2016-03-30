'use strict';

const denodeify = require('denodeify');
const Facebook = require('fb');
const api = denodeify(Facebook.napi);

const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
const pageId = process.env.FB_PAGE_ID;

// See introspect()
// Also available: html_source
const defaultFields = {
	article: [
		'id',
		'canonical_url',
		'development_mode',
		'most_recent_import_status',
		'photos',
		'published',
		'videos',
	],
	status: [
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

const list = ({mode = 'development', fields = []} = {}) => {
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
	);
};

module.exports = {
	list,
	get,
	introspect,
	post,
	delete: del,
};
