'use strict';

const fbApi = require('../lib/fbApi');
const db = require('../lib/database');
const filterPromise = require('@quarterto/filter-promise');
const transform = require('../lib/transform');
const articleModel = require('../models/article');
const postModel = require('../models/post');

module.exports = async function abController() {
	const since = await db.getLastABCheck();
	await db.setLastABCheck(Date.now()); // set this as soon as possible because this might take a while
	const posts = since ? (await fbApi.posts({since})) : []; // don't convert any posts on first ever run

	const newPosts = await filterPromise(posts, async function(post) {
		if(await postModel.get(post)) {
			await postModel.markRemoved(post);
			return false;
		}

		return true;
	});

	const articles = await Promise.all(newPosts.map(articleModel.get));

	const renderableArticles = await filterPromise(articles, async function(article) {
		try {
			article.rendered = await transform(article);
			return true;
		} catch(e) {
			console.log(e);
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
