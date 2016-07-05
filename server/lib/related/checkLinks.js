'use strict';

const fbApi = require('../fbApi');
const articleModel = require('../../models/article');

const checkLinks = hrefs => Promise.all(
	hrefs.map(href =>
		articleModel.getCanonical(href)
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
