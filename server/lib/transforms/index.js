'use strict';

const cheerio = require('cheerio');

const stripBody = require('./stripBody');
const addImageDimensions = require('./addImageDimensions');
const convertBrightcove = require('./convertBrightcove');
const removeEmptyElements = require('./removeEmptyElements');

module.exports = body => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
		stripBody,
		addImageDimensions,
		convertBrightcove,
		removeEmptyElements,
	].map(transform => transform($)))
	.then(() => $);
};
