'use strict';

const cheerio = require('cheerio');

const stripBody = require('./transforms/stripBody');

module.exports = body => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
		stripBody,
	].map(transform => transform($)))
	.then(() => $);
};
