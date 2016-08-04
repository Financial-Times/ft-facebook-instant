'use strict';

const postModel = require('../models/post');
const denodeify = require('denodeify');
const csvStringify = denodeify(require('csv-stringify'));
const promiseLoopInterval = require('@quarterto/promise-loop-interval');

const AB_POLL_INTERVAL = 1 * 60 * 1000;

const getExtra = post => (post.status ? JSON.stringify(post.status) : post.error);

const logRemovedPost = post => {
	console.log(`${Date()}: A/B: removed ${post.canonical} from test, because ${post.reason}${getExtra(post) ? `: ${getExtra(post)}` : ''}`);
};

async function abController() {
	try {
		const posts = await postModel.get();

		if(!posts.length) {
			console.log(`${Date()}: A/B: no new posts to A/B test`);
			return; // don't convert posts if there aren't any
		}

		const {testable, untestable} = await postModel.partitionTestable(posts);
		untestable.forEach(logRemovedPost);
		await Promise.all(testable.map(postModel.bucketAndPublish));

		if(testable.length) {
			const testUuids = testable.filter(({bucket}) => bucket === 'test').map(({uuid}) => uuid);
			const controlUuids = testable.filter(({bucket}) => bucket === 'control').map(({uuid}) => uuid);
			console.log(`${Date()}: A/B: post buckets
test: ${testUuids.join()}
control: ${controlUuids.join()}`);
		} else {
			console.log(`${Date()}: A/B: none of the new posts could be added to the test`);
		}
	} catch(e) {
		console.error(e.stack);
	}
}

module.exports = promiseLoopInterval(abController, AB_POLL_INTERVAL);

module.exports.abController = abController;

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
