'use strict';

const merge = require('lodash.merge');
const fbApi = require('../lib/fbApi');
const articleModel = require('../models/article');
const mode = require('../lib/mode').get();

const pageId = process.env.FB_PAGE_ID;

const addCanonical = post => articleModel.getCanonical(post.link)
// Some links don't resolve to canonical URLs in Elastic Search, so just resolve them
.catch(e => articleModel.resolveUrl(post.link))
.then(canonical => Object.assign(post, {canonical}));

const getPostDetails = id => fbApi.call(
	`/${id}`,
	'GET', {
		fields: 'name,link,created_time,message,id,description,is_published,updated_time,is_popular',
	}
)
.then(details => addCanonical(details));

const getPostShares = id => fbApi.call(
	`/${id}`,
	'GET', {
		fields: 'shares',
	}
)
.then(result => result.shares.count);

const getObjectShares = id => fbApi.call(
	`/${id}`,
	'GET', {
		fields: 'share',
	}
)
.then(result => ({
	shares: result.share.share_count,
	comments: result.share.comment_count,
}));

const getObjectLikes = id => fbApi.call(
	`/${id}/likes`,
	'GET',
	{
		summary: 1,
		fields: 'summary',
	}
)
.then(result => result.summary.total_count);

const getObjectComments = id => fbApi.call(
	`/${id}/comments`,
	'GET',
	{
		summary: 1,
		fields: 'summary',
	}
)
.then(result => result.summary.total_count);

const getPostInsights = id => fbApi.call(
	`/${id}/insights/post_consumptions_by_type`,
	'GET', {
		fields: 'period,values',
		period: 'lifetime',
	}
)
.then(result => ({
	insights: {
		post: result.data[0].values[0].value,
	},
}));

const addInstantArticleInsights = ({post, metric, period}) => fbApi.call(
	`/${post.canonical}`,
	'GET',
	{
		fields: `instant_article{insights.metric(${metric}).period(${period})}`,
	}
)
.then(results => {
	post.ia[mode].insights[metric] = results.instant_article.insights.data;
	return post;
});

const addInstantArticle = post => fbApi.find({
	canonical: post.canonical,
	fields: ['id', 'development_mode', 'published', 'most_recent_import_status{status}'],
})
.then(ia => Object.assign(post, {ia}))
.then(enrichedPost => {
	if(enrichedPost.ia[mode].nullRecord) return Promise.resolve(enrichedPost);
	enrichedPost.ia[mode].insights = {};

	return Promise.all([
		addInstantArticleInsights({post: enrichedPost, metric: 'all_views', period: 'day'}),
		addInstantArticleInsights({post: enrichedPost, metric: 'all_view_durations', period: 'week'}),
		addInstantArticleInsights({post: enrichedPost, metric: 'all_scrolls', period: 'week'}),
	])
	.then(() => enrichedPost);
});

const getPostSocial = id => Promise.all([
	getPostShares(id),
	getObjectLikes(id),
	getObjectComments(id),
])
.then(([shares, likes, comments]) => ({
	social: {
		post: {shares, likes, comments},
	},
}));

const getCanonicalSocial = id => Promise.all([
	getObjectShares(id),
])
.then(([shares]) => ({
	social: {
		canonical: {shares},
	},
}));

const enrich = post => Promise.all([
	getPostDetails(post.id),
	getPostSocial(post.id),
	getPostInsights(post.id),
])
.then(([...args]) => merge({}, ...args));

const enrichCanonical = post => Promise.all([
	addInstantArticle(post),
	getCanonicalSocial(post.canonical),
])
.then(([...args]) => merge({}, ...args));

module.exports = (req, res, next) => fbApi.call(
	`/${pageId}/posts`,
	'GET',
	{
		fields: 'type',
		since: '2016-04-26',
		__limit: 0,
	}
)
.then(response => response.data)
.then(posts => posts.filter(post => post.type === 'link'))
.then(posts => Promise.all(posts.map(enrich)))
.then(posts => Promise.all(
	posts.map(post => (post.canonical ? enrichCanonical(post) : Promise.resolve(post))) ))
.then(posts => posts.filter(post => !!post))
.then(posts => res.json(posts))
.catch(next);
