'use strict';

const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const path = require('path');
const denodeify = require('denodeify');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';

const diskCache = cacheManager.caching({
	store: fsStore,
	options: {
		ttl: 6 * 60 * 60, // time to live in seconds
		maxsize: 20 * 1024 * 1024, // max on-disk cache size in bytes
		path: path.resolve(process.cwd(), 'cache/articles'), // path for on-disk cache
		preventfill: false, // prevent automatically populating the memory cache with existing files
		fillcallback: undefined, // callback fired after the initial cache filling is completed
		zip: false, // zip cache files on disk to save space
	},
});

const cacheSet = denodeify(diskCache.set);
const cacheGet = denodeify(diskCache.get);
// const cacheDel = denodeify(diskCache.del);

module.exports = uuid => cacheGet(uuid)
.then(cached => {
	if(cached) {
		return cached;
	}

	return signedFetch(`https://${elasticSearchUrl}/${index}/item/${uuid}`)
		.then(fetchres.json)
		.then(json => json._source)
		.then(article => cacheSet(uuid, article));
});

