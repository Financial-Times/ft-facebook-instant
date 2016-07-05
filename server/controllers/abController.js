'use strict';

const postModel = require('../models/post');
const denodeify = require('denodeify');
const csvStringify = denodeify(require('csv-stringify'));
const promiseLoopInterval = require('@quarterto/promise-loop-interval');

const AB_POLL_INTERVAL = 1 * 60 * 1000;

const logRemovedPost = (reason, getExtra = () => '') => post => {
	console.log(`${Date()}: A/B: removed ${post.canonical} from test, because ${reason}${getExtra(post) ? `: ${getExtra(post)}` : ''}`);
};

module.exports = promiseLoopInterval(async function abController() {
	const posts = await postModel.get();

	if(!posts.length) {
		console.log(`${Date()}: A/B: no new posts to A/B test`);
		return; // don't convert posts if there aren't any
	}

	const [newPosts, dupePosts] = await postModel.markDuplicates(posts);
	dupePosts.forEach(logRemovedPost('we\'ve seen it already', post => JSON.stringify(post.status)));

	const [renderablePosts, unrenderablePosts] = await postModel.partitionRenderable(newPosts);
	unrenderablePosts.forEach(logRemovedPost('we couldn\'t render it', post => post.error));

	await Promise.all(renderablePosts.map(postModel.bucketAndPublish));

	if(renderablePosts.length) {
		const testUuids = renderablePosts.filter(({bucket}) => bucket === 'test').map(({uuid}) => uuid);
		const controlUuids = renderablePosts.filter(({bucket}) => bucket === 'control').map(({uuid}) => uuid);
		console.log(`${Date()}: A/B: testing posts, test: ${testUuids.join()}, control: ${controlUuids.join()}`);
	} else {
		console.log(`${Date()}: A/B: none of the new posts could be added to the test`);
	}
}, AB_POLL_INTERVAL);

module.exports.route = (req, res, next) => {
	const columns = ['canonical', 'bucket'];

	postModel.getBuckets()
		.then(posts => csvStringify(posts, {columns, header: true}))
		.then(csv => {
			res.type('csv');
			res.send(csv);
		})
		.catch(next);
};
