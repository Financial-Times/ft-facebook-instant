'use strict';

const denodeify = require('denodeify');
const Facebook = require('fb');
const api = denodeify(Facebook.napi);

const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
const pageId = process.env.FB_PAGE_ID;

Facebook.options({
	version: 'v2.5',
	accessToken,
});

const list = (params = {mode: 'development'}) => api(
	`/${pageId}/instant_articles`,
	'GET',
	{
		development_mode: (params.mode === 'development'),

		// Not sure what the options are here
		summary: 'total_count',
	}
);

const get = (params = {}) => {
	if(!params.id) {
		throw Error('Missing required parameter [id]');
	}

	return api(
		`/${params.id}`,
		'GET',
		{}
	);
};

const post = (params = {mode: 'development', published: false}) => {
	if(!params.html) {
		throw Error('Missing required parameter [html]');
	}

	return api(
		`/${pageId}/instant_articles`,
		'POST',
		{
			development_mode: (params.mode === 'development'),
			published: !!params.published,
			html_source: params.html,
		}
	);
};

const del = (params = {}) => {
	if(!params.id) {
		throw Error('Missing required parameter [id]');
	}

	return api(
		`/${params.id}`,
		'DELETE',
		{}
	);
};

module.exports = {
	list,
	get,
	post,
	delete: del,
};
