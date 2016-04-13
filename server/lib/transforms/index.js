'use strict';

const cheerio = require('cheerio');

const addImageDimensions = require('./addImageDimensions');
const convertBrightcove = require('./convertBrightcove');
const convertYoutube = require('./convertYoutube');
const convertTweets = require('./convertTweets');
const removeEmptyElements = require('./removeEmptyElements');
const removeInvalidLinks = require('./removeInvalidLinks');
const removeInvalidRelated = require('./removeInvalidRelated');
const transformLinks = require('./transformLinks');
const transformSlideshows = require('./transformSlideshows');

module.exports = (body, warnings) => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
		addImageDimensions,
		convertBrightcove,
		convertYoutube,
		convertTweets,
		removeEmptyElements,
		removeInvalidLinks,
		removeInvalidRelated,
		transformLinks,
		transformSlideshows,
	].map(transform => transform($, warnings)))
	.then(() => $);
};
