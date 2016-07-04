'use strict';

const fbApi = require('../lib/fbApi');
const db = require('../lib/database');
const filterPromise = require('@quarterto/filter-promise');
const transform = require('../lib/transform');
const articleModel = require('../models/article');
const postModel = require('../models/post');
const denodeify = require('denodeify');
const csvStringify = denodeify(require('csv-stringify'));

module.exports = async function abController() {
	const since = await db.getLastABCheck();
	await db.setLastABCheck(Date.now()); // set this as soon as possible because this might take a while
	const posts = since ? (await fbApi.posts({since})) : [];

	if(!posts.length) {
		return; // don't convert any posts on first ever run
	}

	const newPosts = await posts.reduce(async function markDupe(seen, post) {
		// remove new posts that are already in the AB test *or* are in the current batch multiple times
		// (except not actually remove, but mark as removed so future runs can see them)
		const alreadyInTest = await postModel.get(post);
		const dupeInBatch = seen.has(post);
		if(alreadyInTest || dupeInBatch) {
			console.log(`${Date()}: A/B: removing post ${post}, ${JSON.stringify({alreadyInTest, dupeInBatch})}`);
			await postModel.markRemoved(post);
			seen.delete(post);
		} else {
			seen.add(post);
		}

		return newPosts;
	}, new Set());

	const articles = await Promise.all(newPosts.map(articleModel.get));

	const renderableArticles = await filterPromise(articles, async function isArticleRenderable(article) {
		try {
			article.rendered = await transform(article);
			return true;
		} catch(e) {
			console.log(`${Date()}: A/B: removing ${article.canonical} from test, could not render (${e})`);
			return false;
		}
	});

	for(const article of renderableArticles) {
		const bucket = await postModel.setWithBucket(article.canonical, article);
		if(bucket === 'test') {
			const {id} = await fbApi.post({uuid: article.uuid, html: article.rendered.html, published: true});
			await articleModel.setImportStatus({article, id, warnings: article.rendered.warnings, username: 'daemon', type: 'ab'});
		}
	}

	if(renderableArticles.length) {
		const testUuids = renderableArticles.filter(({bucket}) => bucket === 'test').map(({uuid}) => uuid);
		const controlUuids = renderableArticles.filter(({bucket}) => bucket === 'control').map(({uuid}) => uuid);
		console.log(`${Date()}: A/B: testing posts, test: ${testUuids.join()}, control: ${controlUuids.join()}`);
	} else {
		console.log(`${Date()}: A/B: no new posts to A/B test`);
	}
};

module.exports.route = (req, res, next) => {
	const columns = ['canonical', 'bucket'];

	postModel.getBuckets()
		.then(posts => posts.filter(({bucket}) => bucket !== 'removed'))
		.then(posts => csvStringify(posts, {columns, header: true}))
		.then(csv => {
			res.type('csv');
			res.send(csv);
		})
		.catch(next);
};
