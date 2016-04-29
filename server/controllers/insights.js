'use strict';

const fbApi = require('../lib/fbApi');
const url = require('url');
const pageId = process.env.FB_PAGE_ID;

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


const postsResultPath = 'posts:$.data.*.link';
const linksResultPath = 'links:$.*.og_object.url';

const createPostsQuery = params => {
	const postEdgesQuery = postEdgeKeys.map(key => `${key}.limit(0).summary(true)`);
	const insightsQuery = `insights.metric(${insightsMetricsKeys.join(',')}){${insightsKeys.join(',')}}`;
	const postAttributesQuery = postAttributeKeys.concat(postEdgesQuery).concat(insightsQuery).join(',');

	params.fields = postAttributesQuery;
	const paramsQuery = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');

	return `/${pageId}/posts?${paramsQuery}&fields=${postAttributesQuery}`;
};

const createLinksQuery = () => `?ids={result=${postsResultPath}}&fields=og_object{type,url}`;

const createCanonicalsQuery = () => {
	const iaMetricQueries = Object.keys(iaMetricTypes).map(key => `insights.metric(${key}).period(${iaMetricTypes[key]}).as(metrics_${key})`);
	const iaKeysStatusOnlyQuery = iaKeysStatusOnly.map(key => `${key}{status}`);
	const iaQuery = `instant_article{${iaKeys.concat(iaKeysStatusOnlyQuery).concat(iaMetricQueries).join(',')}}`;
	const canonicalAttributesQuery = canonicalKeys.concat(iaQuery).join(',');

	return `?ids={result=${linksResultPath}}&fields=${canonicalAttributesQuery}`;
};

const createQuery = params => {
	const queries = {
		posts: createPostsQuery(params),
		links: createLinksQuery(params),
		canonicals: createCanonicalsQuery(params),
	};

	return Object.keys(queries).map(key => ({
		method: 'GET',
		omit_response_on_success: false,
		name: key,
		relative_url: queries[key],
	}));
};

const processResults = ([postsBatch, links, canonicals]) => {
	const posts = postsBatch.data;

	posts.forEach(post => {
		if(post.link && links[post.link]) {
			post.link = links[post.link];
			if(post.link.og_object && post.link.og_object.url) {
				post.canonical = canonicals[post.link.og_object.url];
			}
		}
	});

	return posts;
};

const executeQuery = params => fbApi.call('', 'POST', {
	batch: createQuery(params),
	include_headers: false,
	__dependent: true,
})
.then(batchResult => {
	// End of data reached
	if(batchResult === null) return null;

	const result = processResults(batchResult);

	if(batchResult[0].paging && batchResult[0].paging.next) {
		const nextParams = url.parse(batchResult[0].paging.next, true).query;

		delete nextParams.access_token;
		delete nextParams.fields;

		return executeQuery(nextParams)
			.then(nextResult => (nextResult ? result.concat(nextResult) : result));
	}

	return result;
});

module.exports = (req, res, next) => executeQuery({since: '2016-04-26', limit: 50})
.then(result => res.json(result))
.catch(next);
