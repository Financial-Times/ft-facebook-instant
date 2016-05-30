'use strict';

const fbApi = require('../fbApi');
const articleModel = require('../../models/article');

const checkLink = href => articleModel.getCanonical(href)
	.catch(() => href)
	.then(url => fbApi.get({id: url, type: 'related'})
		.then(({og_object: ogObject}) => ogObject && ogObject.title && url)
	);

module.exports = checkLink;
