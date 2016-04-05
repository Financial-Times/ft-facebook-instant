'use strict';

const cheerio = require('cheerio');

const stripBody = require('./transforms/stripBody');
const getImageDimensions = require('./transforms/getImageDimensions');

module.exports = body => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
		stripBody,
		getImageDimensions,
	].map(transform => transform($)))
	.then(() => $);
};
