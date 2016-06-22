'use strict';

const retry = require('../lib/retry');
const ftApi = require('../lib/ftApi');
const uuidRegex = require('../lib/uuid');
const database = require('../lib/database');
const RichError = require('../lib/richError');

const extractUuid = string => (uuidRegex.exec(string) || [])[0];

const isAbsoluteUrl = url => /^(?:\w+:)\/\//.test(url);

const resolveUrl = url => retry.fetch(url, {errorFrom: 'articles.resolveUrl', errorExtra: {url}})
.then(res => res.url);

// Follow redirects first
const deriveCanonical = key => {
	let uuid = extractUuid(key);
	if(uuid) {
		return ftApi.getCanonicalFromUuid(uuid);
	}

	if(isAbsoluteUrl(key)) {
		return resolveUrl(key)
		.then(resolved => {
			uuid = extractUuid(resolved);
			if(uuid) {
				return ftApi.getCanonicalFromUuid(uuid);
			}
			return ftApi.verifyCanonical(key);
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
