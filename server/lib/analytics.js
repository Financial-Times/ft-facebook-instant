'use strict';

const {version} = require('../../package.json');

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
		},
	};

	return `https://spoor-api.ft.com/ingest?data=${encodeURIComponent(JSON.stringify(data))}`;
};
