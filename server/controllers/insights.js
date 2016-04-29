'use strict';

// const merge = require('lodash.merge');
const fbApi = require('../lib/fbApi');
// const articleModel = require('../models/article');
// const mode = require('../lib/mode').get();

const pageId = process.env.FB_PAGE_ID;

// const addCanonical = post => articleModel.getCanonical(post.link)
// // Some links don't resolve to canonical URLs in Elastic Search, so just resolve them
// .catch(e => articleModel.resolveUrl(post.link))
// .then(canonical => Object.assign(post, {canonical}));

// const getPostDetails = id => fbApi.call(
// 	`/${id}`,
// 	'GET', {
// 		fields: 'name,link,created_time,message,id,description,is_published,updated_time,is_popular',
// 	}
// )
// .then(details => addCanonical(details));

// const getPostShares = id => fbApi.call(
// 	`/${id}`,
// 	'GET', {
// 		fields: 'shares',
// 	}
// )
// .then(result => result.shares.count);

// const getObjectShares = id => fbApi.call(
// 	`/${id}`,
// 	'GET', {
// 		fields: 'share',
// 	}
// )
// .then(result => ({
// 	shares: result.share.share_count,
// 	comments: result.share.comment_count,
// }));

// const getObjectLikes = id => fbApi.call(
// 	`/${id}/likes`,
// 	'GET',
// 	{
// 		summary: 1,
// 		fields: 'summary',
// 	}
// )
// .then(result => result.summary.total_count);

// const getObjectComments = id => fbApi.call(
// 	`/${id}/comments`,
// 	'GET',
// 	{
// 		summary: 1,
// 		fields: 'summary',
// 	}
// )
// .then(result => result.summary.total_count);

// const getPostInsights = id => fbApi.call(
// 	`/${id}/insights/post_consumptions_by_type`,
// 	'GET', {
// 		fields: 'period,values',
// 		period: 'lifetime',
// 	}
// )
// .then(result => ({
// 	insights: {
// 		post: result.data[0].values[0].value,
// 	},
// }));

// const addInstantArticleInsights = ({post, metric, period}) => fbApi.call(
// 	`/${post.canonical}`,
// 	'GET',
// 	{
// 		fields: `instant_article{insights.metric(${metric}).period(${period})}`,
// 	}
// )
// .then(results => {
// 	post.ia[mode].insights[metric] = results.instant_article.insights.data;
// 	return post;
// });

// const addInstantArticle = post => fbApi.find({
// 	canonical: post.canonical,
// 	fields: ['id', 'development_mode', 'published', 'most_recent_import_status{status}'],
// })
// .then(ia => Object.assign(post, {ia}))
// .then(enrichedPost => {
// 	if(enrichedPost.ia[mode].nullRecord) return Promise.resolve(enrichedPost);
// 	enrichedPost.ia[mode].insights = {};

// 	return Promise.all([
// 		addInstantArticleInsights({post: enrichedPost, metric: 'all_views', period: 'day'}),
// 		addInstantArticleInsights({post: enrichedPost, metric: 'all_view_durations', period: 'week'}),
// 		addInstantArticleInsights({post: enrichedPost, metric: 'all_scrolls', period: 'week'}),
// 	])
// 	.then(() => enrichedPost);
// });

// const getPostSocial = id => Promise.all([
// 	getPostShares(id),
// 	getObjectLikes(id),
// 	getObjectComments(id),
// ])
// .then(([shares, likes, comments]) => ({
// 	social: {
// 		post: {shares, likes, comments},
// 	},
// }));

// const getCanonicalSocial = id => Promise.all([
// 	getObjectShares(id),
// ])
// .then(([shares]) => ({
// 	social: {
// 		canonical: {shares},
// 	},
// }));

// const enrich = post => Promise.all([
// 	getPostDetails(post.id),
// 	getPostSocial(post.id),
// 	getPostInsights(post.id),
// ])
// .then(([...args]) => merge({}, ...args));

// const enrichCanonical = post => Promise.all([
// 	addInstantArticle(post),
// 	getCanonicalSocial(post.canonical),
// ])
// .then(([...args]) => merge({}, ...args));

// module.exports = (req, res, next) => fbApi.call(
// 	`/${pageId}/posts`,
// 	'GET',
// 	{
// 		fields: 'type',
// 		since: '2016-04-26',
// 		__limit: 0,
// 	}
// )
// .then(response => response.data)
// .then(posts => posts.filter(post => post.type === 'link'))
// .then(posts => Promise.all(posts.map(enrich)))
// .then(posts => Promise.all(
// 	posts.map(post => (post.canonical ? enrichCanonical(post) : Promise.resolve(post))) ))
// .then(posts => posts.filter(post => !!post))
// .then(posts => res.json(posts))
// .catch(next);

const postAttributeKeys = [
	'type',
	'shares',
	'name',
	'link',
	'created_time',
	'message',
	'id',
	'description',
	'is_published',
	'updated_time',
	'is_popular',
];

const postEdgeKeys = [
	'likes',
	'comments',
];

const insightsMetricsKeys = [
	'post_impressions',
	'post_impressions_unique',
	'post_impressions_fan_unique',
	'post_impressions_organic_unique',
	'post_impressions_viral',
	'post_impressions_viral_unique',
	'post_impressions_by_story_type',
	'post_impressions_by_story_type_unique',
	'post_consumptions',
	'post_consumptions_unique',
	'post_consumptions_by_type',
	'post_consumptions_by_type_unique',
	'post_engaged_users',
	'post_negative_feedback',
	'post_engaged_fan',
	'post_fan_reach',
	'post_stories_by_action_type',
];

const insightsKeys = [
	'name',
	'description',
	'period',
	'values',
];

const iaKeys = [
	'id',
	'development_mode',
	'published',
];

const iaKeysStatusOnly = [
	'most_recent_import_status',
];

const canonicalKeys = [
	'share',
];

const iaMetricTypes = {
	all_views: 'day',
	all_view_durations: 'week',
	all_scrolls: 'week',
};


const linkResultPath = 'links:$.posts.data.*.link';
const canonicalResultPath = 'canonicals:$.*.og_object.url';

const createLinksQuery = ({since}) => {
	const postEdgesQuery = postEdgeKeys.map(key => `${key}.limit(0).summary(true)`);
	const insightsQuery = `insights.metric(${insightsMetricsKeys.join(',')}){${insightsKeys.join(',')}}`;
	const postAttributesQuery = postAttributeKeys.concat(postEdgesQuery).concat(insightsQuery).join(',');

	return `/${pageId}?fields=posts.since(${since}){${postAttributesQuery}}`;
};

const createCanonicalsQuery = () => `?ids={result=${linkResultPath}}&fields=og_object{type,url}`;

const createIaQuery = () => {
	const iaMetricQueries = Object.keys(iaMetricTypes).map(key => `insights.metric(${key}).period(${iaMetricTypes[key]}).as(metrics_${key})`);
	const iaKeysStatusOnlyQuery = iaKeysStatusOnly.map(key => `${key}{status}`);
	const iaQuery = `instant_article{${iaKeys.concat(iaKeysStatusOnlyQuery).concat(iaMetricQueries).join(',')}}`;
	const canonicalAttributesQuery = canonicalKeys.concat(iaQuery).join(',');

	return `?ids={result=${canonicalResultPath}}&fields=${canonicalAttributesQuery}`;
};

const createQuery = options => {
	const queries = {
		links: createLinksQuery(options),
		canonicals: createCanonicalsQuery(options),
		ias: createIaQuery(options),
	};

	return Object.keys(queries).map(key => ({
		method: 'GET',
		omit_response_on_success: false,
		name: key,
		relative_url: queries[key],
	}));
};

const executeQuery = () => {
	const batch = createQuery({since: '2016-04-26'});

	return fbApi.call('', 'POST', {
		batch,
		include_headers: false,
	})
	.then(result => result.map())
};

module.exports = (req, res, next) => {
	return executeQuery()
	.then(result => res.json(result));
};
