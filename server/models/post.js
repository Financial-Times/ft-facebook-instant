'use strict';

const db = require('../lib/database');
const getCanonical = require('./canonical');

export async function get(url) {
	const canonical = await getCanonical(url);
	return db.getFBLinkPost(canonical);
}

export async function set(url, article) {
	const canonical = await getCanonical(url);
	return db.setFBLinkPost(canonical, article);
}

export async function setWithBucket(url, article) {
	article.bucket = Math.random() < 0.5 ? 'test' : 'control';
	await set(url, article);
	return article.bucket;
}

export const markRemoved = url => set(url, {bucket: 'removed'});
