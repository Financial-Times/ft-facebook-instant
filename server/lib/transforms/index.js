'use strict';

const cheerio = require('cheerio');

const stripBody = require('./stripBody');
const addImageDimensions = require('./addImageDimensions');
const convertBrightcove = require('./convertBrightcove');
const convertYoutube = require('./convertYoutube');
const removeEmptyElements = require('./removeEmptyElements');
const removeInvalidLinks = require('./removeInvalidLinks');
const removeInvalidRelated = require('./removeInvalidRelated');

module.exports = body => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
		stripBody,
		addImageDimensions,
		convertBrightcove,
		convertYoutube,
		removeEmptyElements,
		removeInvalidLinks,
		removeInvalidRelated,
	].map(transform => transform($)))
	.then(() => $);
};
