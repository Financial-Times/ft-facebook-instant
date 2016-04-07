'use strict';

const cheerio = require('cheerio');

const stripBody = require('./stripBody');
const addImageDimensions = require('./addImageDimensions');
const convertBrightcove = require('./convertBrightcove');
const convertYoutube = require('./convertYoutube');
const convertTweets = require('./convertTweets');
const removeEmptyElements = require('./removeEmptyElements');
const removeInvalidLinks = require('./removeInvalidLinks');

module.exports = body => {
	const $ = cheerio.load(body, {decodeEntities: false});

	return Promise.all([
		stripBody,
		addImageDimensions,
		convertBrightcove,
		convertYoutube,
		convertTweets,
		removeEmptyElements,
		removeInvalidLinks,
	].map(transform => transform($)))
	.then(() => $);
};
