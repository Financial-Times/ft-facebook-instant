'use strict';

const fbApi = require('../lib/fbApi');
const articleModel = require('../models/article');
const mode = require('../lib/mode').get();

const pageId = process.env.FB_PAGE_ID;

const requestPostDetails = posts => posts.map(post => ({
	method: 'get',
	relative_url: `${post.id}?fields=name,link,created_time,message,id,description,is_published`,
}));

const requestPostInsights = posts => posts.map(post => ({
	method: 'get',
	relative_url: `${post.id}/insights/post_consumptions_by_type?period=lifetime&fields=period,values`,
}));

const parsePostDetails = results => results.map((result, index) => JSON.parse(result.body));

const parsePostInsights = results => results.map((result, index) => ({insights: JSON.parse(result.body).data[0]}));

const enrich = posts => {
	const size = posts.length;

	const batch = requestPostDetails(posts)
	.concat(requestPostInsights(posts));

	return fbApi.call('', 'post', {batch})
		.then(results => {
			const enriched = parsePostDetails(results.slice(0, size));
			const insights = parsePostInsights(results.slice(size, size * 2));

			return enriched.map((item, key) => Object.assign(item, insights[key]));
		});
};

const addInstantArticleInsights = post => {
	if(post.ia[mode].nullRecord) return Promise.resolve(post);
	return fbApi.call(
		`?id=${post.canonical}&fields=instant_article{insights.metric(all_views).period(day)}`,
		'GET',
		{}
	)
	.then(views => {
		post.ia = Object.assign(post.ia, {views});
		return post;
	});
};

const addInstantArticle = post => articleModel.getCanonical(post.link)
.then(canonical => Object.assign(post, {canonical}))
.then(obj => fbApi.find({canonical: obj.canonical, fields: ['id', 'development_mode', 'published', 'most_recent_import_status{status}']}))
.then(ia => Object.assign(post, {ia}))
.then(addInstantArticleInsights)
.catch(() => null);

const addInstantArticles = posts => Promise.all(posts.map(addInstantArticle));

module.exports = (req, res, next) => fbApi.call(
	`/${pageId}/posts`,
	'GET',
	{
		__limit: 20,
	}
)
.then(response => response.data)
.then(enrich)
.then(addInstantArticles)
.then(posts => posts.filter(post => !!post))
.then(posts => res.json(posts))
.catch(next);
