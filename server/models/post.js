'use strict';

const db = require('../lib/database');
const getCanonical = require('./canonical');

exports.get = async function get(url) {
	const canonical = await getCanonical(url);
	return db.getFBLinkPost(canonical);
};

exports.getBuckets = () => db.getFBLinkPosts().then(posts => posts.filter(post => post.bucket !== 'removed'));

exports.set = async function set(url, article) {
	const canonical = await getCanonical(url);
	return db.setFBLinkPost(canonical, article);
};

exports.setWithBucket = async function setWithBucket(url, article) {
	article.bucket = Math.random() < 0.5 ? 'test' : 'control';
	await exports.set(url, article);
	return article.bucket;
};

exports.markRemoved = url => exports.set(url, {bucket: 'removed'});
