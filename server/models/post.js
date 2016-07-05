'use strict';

const partitionPromise = require('@quarterto/partition-promise');
const transform = require('../lib/transform');
const articleModel = require('./article');
const database = require('../lib/database');
const getCanonical = require('./canonical');
const fbApi = require('../lib/fbApi');
const mode = require('../lib/mode');

exports.get = async function get() {
	const since = await database.getLastABCheck();
	await database.setLastABCheck(Date.now()); // set this as soon as possible because this might take a while
	if(since) {
		return Promise.all(
			(await fbApi.posts({since}))
				.map(async function mapPosts(url) {
					const canonical = await getCanonical(url);
					return articleModel.get(canonical);
				})
		);
	}

	return [];
};

exports.markDuplicates = posts => posts.reduce(async function markDupe(previous, post) {
	const [newPosts, dupePosts] = await previous;
	// remove new posts that are already in the AB test *or* are in the current batch multiple times
	// (except not actually remove, but mark as removed so future runs can see them)
	const alreadyInTest = !!(await database.getFBLinkPost(post.canonical));
	const dupeInBatch = newPosts.has(post.canonical);

	if(alreadyInTest || dupeInBatch) {
		await exports.markRemoved(post.canonical);
		post.status = {alreadyInTest, dupeInBatch};
		newPosts.delete(post.canonical);
		dupePosts.set(post.canonical, post);
		return [newPosts, dupePosts];
	}

	newPosts.set(post.canonical, post);
	return [newPosts, dupePosts];
}, [new Map(), new Map()]).then(results => results.map(map => Array.from(map.values())));

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

exports.bucketAndPublish = async function bucketAndPublish(post) {
	const bucket = await exports.setWithBucket(post);
	if(bucket === 'test') {
		await articleModel.postAndSetStatus({
			article: post,
			published: mode.get() === 'production',
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

exports.markRemoved = url => database.setFBLinkPost(url, {bucket: 'removed'});
