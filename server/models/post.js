'use strict';

const partitionPromise = require('@quarterto/partition-promise');
const transform = require('../lib/transform');
const articleModel = require('./article');
const database = require('../lib/database');
const getCanonical = require('./canonical');
const fbApi = require('../lib/fbApi');

exports.get = async function get() {
	const since = await database.getLastABCheck();
	await database.setLastABCheck(Date.now()); // set this as soon as possible because this might take a while
	if(since) {
		return Promise.all(
			(await fbApi.posts({since}))
				.map(getCanonical)
				.map(articleModel.get)
		);
	}

	return [];
};

exports.markDuplicates = posts => {
	const seen = new Set();

	return partitionPromise(posts, async function markDupe(post) {
		const {canonical} = post;

		// remove new posts that are already in the AB test *or* are in the current batch multiple times
		// (except not actually remove, but mark as removed so future runs can see them)
		const alreadyInTest = await database.getFBLinkPost(post.canonical);
		const dupeInBatch = seen.has(post.canonical);

		if(alreadyInTest || dupeInBatch) {
			await exports.markRemoved(canonical);
			post.status = {alreadyInTest, dupeInBatch};
			return false;
		}

		seen.add(post.canonical);
		return true;
	});
};

exports.partitionRenderable = posts => partitionPromise(posts, post => transform(post).then(
	rendered => {
		post.rendered = rendered;
		return true;
	},
	error => {
		post.error = error;
		return false;
	}
));

exports.bucketAndPublish = async function bucketAndPost(post) {
	const bucket = await exports.setWithBucket(post.canonical, post);
	if(bucket === 'test') {
		await articleModel.postAndSetStatus({
			article: post,
			published: true,
			wait: true,
			username: 'daemon',
			type: 'ab',
		});
	}
};

exports.getBuckets = () => database.getFBLinkPosts().then(postUrls => postUrls.filter(post => post.bucket !== 'removed'));

exports.setWithBucket = async function setWithBucket(post, testBucket = Math.random() < 0.5) {
	post.bucket = testBucket ? 'test' : 'control';
	await database.setFBLinkPost(post.canonical, post);
	return post.bucket;
};

exports.markRemoved = url => exports.set(url, {bucket: 'removed'});
