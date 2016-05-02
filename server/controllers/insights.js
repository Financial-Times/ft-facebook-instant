'use strict';

const fbApi = require('../lib/fbApi');
const pageId = process.env.FB_PAGE_ID;
const batchSize = 50;

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


const postsResultPath = 'posts:$.*.link';
const linksResultPath = 'links:$.*.og_object.url';

const getPostsLists = params => {
	params.fields = 'id';
	const paramsQuery = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');

	return fbApi.call(`/${pageId}/posts?${paramsQuery}`, 'GET', {
		__limit: 0,
	});
};

const createPostsQuery = ids => {
	const postEdgesQuery = postEdgeKeys.map(key => `${key}.limit(0).summary(true)`);
	const insightsQuery = `insights.metric(${insightsMetricsKeys.join(',')}){${insightsKeys.join(',')}}`;
	const postAttributesQuery = postAttributeKeys.concat(postEdgesQuery).concat(insightsQuery).join(',');

	const params = {
		ids,
		fields: postAttributesQuery,
	};
	const paramsQuery = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');

	return `?${paramsQuery}`;
};

const createLinksQuery = () => `?ids={result=${postsResultPath}}&fields=og_object{type,url}`;

const createCanonicalsQuery = () => {
	const iaMetricQueries = Object.keys(iaMetricTypes).map(key => `insights.metric(${key}).period(${iaMetricTypes[key]}).as(metrics_${key})`);
	const iaKeysStatusOnlyQuery = iaKeysStatusOnly.map(key => `${key}{status}`);
	const iaQuery = `instant_article{${iaKeys.concat(iaKeysStatusOnlyQuery).concat(iaMetricQueries).join(',')}}`;
	const canonicalAttributesQuery = canonicalKeys.concat(iaQuery).join(',');

	return `?ids={result=${linksResultPath}}&fields=${canonicalAttributesQuery}`;
};

const createQuery = ids => {
	const queries = {
		posts: createPostsQuery(ids),
		links: createLinksQuery(),
		canonicals: createCanonicalsQuery(),
	};

	return Object.keys(queries).map(key => ({
		method: 'GET',
		omit_response_on_success: false,
		name: key,
		relative_url: queries[key],
	}));
};

const processResults = ([posts, links, canonicals]) => {
	let post;
	Object.keys(posts).forEach(id => {
		post = posts[id];
		if(post.link && links[post.link]) {
			post.link = links[post.link];
			if(post.link.og_object && post.link.og_object.url) {
				post.canonical = canonicals[post.link.og_object.url];
			}
		}
	});

	return posts;
};

const executeQuery = ids => fbApi.call('', 'POST', {
	batch: createQuery(ids),
	include_headers: false,
	__dependent: true,
})
.then(processResults);

const batchIdList = idList => {
	const batch = [];
	for(let i = 0; i < idList.length; i += batchSize) {
		batch.push(
			idList
				.slice(i, i + batchSize)
				.map(item => item.id)
		);
	}
	return batch;
};

module.exports = (req, res, next) => getPostsLists({since: '2016-04-26'})
.then(result => (batchIdList(result.data)))
.then(idBatch => Promise.all(idBatch.map(executeQuery)))
.then(batchedResults => [].concat(...batchedResults))
.then(result => res.json(result))
.catch(next);
