'use strict';

const cheerio = require('cheerio');

module.exports = body => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
	].map(transform => transform($)))
	.then(() => $);
};
