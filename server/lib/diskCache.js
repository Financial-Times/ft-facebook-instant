'use strict';

const path = require('path');
const denodeify = require('denodeify');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');

const articleCache = cacheManager.caching({
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

const assetCache = cacheManager.caching({
	store: fsStore,
	options: {
		ttl: 6 * 60 * 60, // time to live in seconds
		maxsize: 20 * 1024 * 1024, // max on-disk cache size in bytes
		path: path.resolve(process.cwd(), 'cache/assets'), // path for on-disk cache
		preventfill: false, // prevent automatically populating the memory cache with existing files
		fillcallback: undefined, // callback fired after the initial cache filling is completed
		zip: false, // zip cache files on disk to save space
	},
});

module.exports = {
	articles: {
		get: denodeify(articleCache.get),
		set: denodeify(articleCache.set),
		del: denodeify(articleCache.del),
	},
	assets: {
		get: denodeify(assetCache.get),
		set: denodeify(assetCache.set),
		del: denodeify(assetCache.del),
	},
};
