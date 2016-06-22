'use strict';

const fbApi = require('../fbApi');
const getCanonical = require('../../models/canonical');

const checkLinks = hrefs => Promise.all(
	hrefs.map(href =>
		getCanonical(href)
			.catch(() => href)
	)
)
.then(
	urls => fbApi.getMany({ids: urls, type: 'related'})
		.then(results => Object.keys(results).map(url =>
			results[url].og_object && results[url].og_object.title && url
		))
);

module.exports = checkLinks;
