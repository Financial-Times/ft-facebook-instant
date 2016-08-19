'use strict';

const {version: packageVersion} = require('../../package.json');
let version;
let slug;
let server;
let release;

const matches = packageVersion.match(/^(\d+\.\d+\.\d+)-([^-]+)(?:-([a-z0-9]{7}))?$/);
if(matches) {
	version = matches[1];
	server = matches[2];
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

			// These should be in system, but those keys aren't automatically mapped to
			// Redshift. This should ideally be resolved, as context isn't the right place
			// for this data.
			system: {
				package_version: packageVersion,
				slug,
				release,
				server,
			},
		},
		system: {
			api_key: process.env.SPOOR_API_KEY,
			source: 'facebook-instant',

			environment: process.env.NODE_ENV,
			is_live: !!prod,

			version,
		},
	};

	return `https://spoor-api.ft.com/ingest?data=${encodeURIComponent(JSON.stringify(data))}`;
};
