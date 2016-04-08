'use strict';

const cheerio = require('cheerio');

const stripBody = require('./stripBody');
const addImageDimensions = require('./addImageDimensions');
const convertBrightcove = require('./convertBrightcove');
const convertYoutube = require('./convertYoutube');
const convertTweets = require('./convertTweets');
const removeEmptyElements = require('./removeEmptyElements');
const removeInvalidLinks = require('./removeInvalidLinks');
const removeInvalidRelated = require('./removeInvalidRelated');
const transformLinks = require('./transformLinks');

module.exports = (body, warnings) => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
		stripBody,
		addImageDimensions,
		convertBrightcove,
		convertYoutube,
		convertTweets,
		removeEmptyElements,
		removeInvalidLinks,
		removeInvalidRelated,
		transformLinks,
	].map(transform => transform($, warnings)))
	.then(() => $);
};
