'use strict';

const {packageVersion = 'dev'} = require('../../package.json');
let version;
let slug;
let release;

const matches = packageVersion.match(/^(\d+\.\d+\.\d+)(.*?)(\b[a-z0-9]{7}\b)$/);
if(matches) {
	version = matches[1];
	slug = matches[3];
}

if(process.env.HEROKU_RELEASE_VERSION) {
	release = process.env.HEROKU_RELEASE_VERSION;
}

module.exports = article => {
	const prod = process.env.NODE_ENV === 'production';
	const data = {
		category: 'page',
		action: 'view',
		context: {
			content: {
				uuid: article.uuid,
				title: article.apiRecord.title,
			},
			product: 'Facebook Instant',
			url: article.canonical,
		},
		system: {
			api_key: process.env.SPOOR_API_KEY,
			source: 'facebook-instant',

			environment: process.env.NODE_ENV,
			is_live: !!prod,

			version,
			packageVersion,
			slug,
			release,
		},
	};

	return `https://spoor-api.ft.com/ingest?data=${encodeURIComponent(JSON.stringify(data))}`;
};
