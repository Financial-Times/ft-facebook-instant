'use strict';

const retry = require('../lib/retry');
const ftApi = require('../lib/ftApi');
const uuidRegex = require('../lib/uuid');
const database = require('../lib/database');
const {format: urlFormat, parse: urlParse} = require('url');
const RichError = require('../lib/richError');

const extractUuid = string => (uuidRegex.exec(string) || [])[0];
const removeQuerystring = key => {
	const parsed = urlParse(key);
	delete parsed.query;
	return urlFormat(parsed);
};

const isAbsoluteUrl = url => /^(?:\w+:)\/\//.test(url);

const resolveUrl = url => retry.fetch(url, {errorFrom: 'articles.resolveUrl', errorExtra: {url}})
.then(res => res.url);

// Follow redirects first
const deriveCanonical = key => {
	const sanitised = removeQuerystring(key); // urls sometimes have uuid-format segids in them

	let uuid = extractUuid(sanitised);
	if(uuid) {
		return ftApi.getCanonicalFromUuid(uuid);
	}

	if(isAbsoluteUrl(sanitised)) {
		return resolveUrl(sanitised)
	.then(resolved => {
		uuid = extractUuid(resolved);
		if(uuid) {
			return ftApi.getCanonicalFromUuid(uuid);
		}
		return ftApi.verifyCanonical(sanitised);
	});
	}

	throw new RichError('Can\'t derive canonical URL from string', {
		extra: {key},
	});
};


const getCanonical = key => database.getCanonical(key)
.then(cached => {
	if(cached) {
		return cached;
	}

	return deriveCanonical(key)
		.then(canonical => database.setCanonical(key, canonical));
});

module.exports = getCanonical;
