'use strict';

const fbApi = require('../lib/fbApi');
const stats = require('stats-lite');
const denodeify = require('denodeify');
const csvStringify = denodeify(require('csv-stringify'));

const pageId = process.env.FB_PAGE_ID;
const BATCH_SIZE = 50;
const VERBOSE_AGGREGATIONS = false;

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

const aggregateMetricBreakdowns = (data) => {
	const aggregations = {};
	let values = [];

	data.sort((a, b) => a.breakdowns.bucket - b.breakdowns.bucket);
	data.forEach(item => {
		const bucket = parseInt(item.breakdowns.bucket, 10);
		const value = parseInt(item.value, 10);
		if(VERBOSE_AGGREGATIONS) aggregations[bucket] = value;
		values = values.concat(Array(value).fill(bucket));
	});

	return Object.assign(aggregations, {
		min: values[0],
		max: values[values.length - 1],
		mean: stats.mean(values),
		median: stats.median(values),
		mode: stats.mode(values),
		stdev: stats.stdev(values),
		p25: stats.percentile(values, 0.25),
		p50: stats.percentile(values, 0.50),
		p75: stats.percentile(values, 0.75),
		p95: stats.percentile(values, 0.95),
	});
};

const flattenIaMetrics = (post, flat) => {
	Object.keys(iaMetricTypes).forEach(key => {
		const metric = post.canonical.instant_article[`metrics_${key}`];
		let aggregations;
		if(metric) {
			switch(iaMetricTypes[key]) {
				case 'day':
					flat[`ia_${key}`] = metric.data.reduce((total, item) => (total + parseInt(item.value, 0)), 0);
					break;
				case 'week':
					aggregations = aggregateMetricBreakdowns(metric.data);
					Object.keys(aggregations).forEach(aggregation => {
						flat[`ia_${key}_${aggregation}`] = aggregations[aggregation];
					});
					break;
				default:
					throw Error(`Unexpected Instant Article metric key [${key}]`);
			}
		}
	});
};

const flattenPost = post => {
	const flat = {
		id: post.id,
		type: post.type,
		name: post.name,
		link: post.link,
		created_time: post.created_time,
		message: post.message,
		description: post.description,
		is_published: post.is_published,
		updated_time: post.updated_time,
	};

	flat.shares = post.shares.count;
	flat.likes = post.likes.summary.total_count;
	flat.comments = post.comments.summary.total_count;

	Object.keys(post.insights).forEach(insightKey => {
		const insight = post.insights[insightKey];
		if(typeof insight.values[0].value === 'object') {
			Object.keys(insight.values[0].value).forEach(valueKey => {
				flat[`insight_${insightKey}_${valueKey.replace(/\s/g, '_')}`] = insight.values[0].value[valueKey];
			});
		} else {
			flat[`insight_${insightKey}`] = insight.values[0].value;
		}
	});

	if(post.canonical) {
		flat.canonical = post.canonical.id;
		flat.canonical_share = post.canonical.share.share_count;
		flat.canonical_comment = post.canonical.share.comment_count;

		if(post.canonical.instant_article) {
			flat.ia_published = post.canonical.instant_article.published;
			flat.ia_import_status = post.canonical.instant_article.most_recent_import_status &&
				post.canonical.instant_article.most_recent_import_status.status;

			flattenIaMetrics(post, flat);
		}
	}

	return flat;
};

const processResults = ([posts, links, canonicals]) => Object.keys(posts).map(id => {
	const post = posts[id];

	if(post.link && links[post.link] && links[post.link].og_object && links[post.link].og_object.url) {
		post.canonical = canonicals[links[post.link].og_object.url];
	}

	if(post.insights) {
		const insights = post.insights.data;
		post.insights = {};
		insights.forEach(item => (post.insights[item.name] = item));
	}

	return post;
})
.map(flattenPost);

const executeQuery = ids => fbApi.call('', 'POST', {
	batch: createQuery(ids),
	include_headers: false,
	__dependent: true,
})
.then(processResults);

const batchIdList = idList => {
	const batch = [];
	for(let i = 0; i < idList.length; i += BATCH_SIZE) {
		batch.push(
			idList
				.slice(i, i + BATCH_SIZE)
				.map(item => item.id)
		);
	}
	return batch;
};

const generateCsv = data => csvStringify(data, {
	header: true,
	columns: {
		id: 'id',
		type: 'type',
		name: 'name',
		link: 'link',
		created_time: 'created_time',
		message: 'message',
		description: 'description',
		is_published: 'is_published',
		updated_time: 'updated_time',
		shares: 'shares',
		likes: 'likes',
		comments: 'comments',
		insight_post_impressions: 'insight_post_impressions',
		insight_post_impressions_unique: 'insight_post_impressions_unique',
		insight_post_impressions_fan_unique: 'insight_post_impressions_fan_unique',
		insight_post_impressions_organic_unique: 'insight_post_impressions_organic_unique',
		insight_post_impressions_viral: 'insight_post_impressions_viral',
		insight_post_impressions_viral_unique: 'insight_post_impressions_viral_unique',
		insight_post_impressions_by_story_type_other: 'insight_post_impressions_by_story_type_other',
		insight_post_impressions_by_story_type_unique_other: 'insight_post_impressions_by_story_type_unique_other',
		insight_post_consumptions: 'insight_post_consumptions',
		insight_post_consumptions_unique: 'insight_post_consumptions_unique',
		insight_post_consumptions_by_type_other_clicks: 'insight_post_consumptions_by_type_other_clicks',
		insight_post_consumptions_by_type_link_clicks: 'insight_post_consumptions_by_type_link_clicks',
		insight_post_consumptions_by_type_unique_other_clicks: 'insight_post_consumptions_by_type_unique_other_clicks',
		insight_post_consumptions_by_type_unique_link_clicks: 'insight_post_consumptions_by_type_unique_link_clicks',
		insight_post_engaged_users: 'insight_post_engaged_users',
		insight_post_negative_feedback: 'insight_post_negative_feedback',
		insight_post_engaged_fan: 'insight_post_engaged_fan',
		insight_post_fan_reach: 'insight_post_fan_reach',
		insight_post_stories_by_action_type_share: 'insight_post_stories_by_action_type_share',
		insight_post_stories_by_action_type_like: 'insight_post_stories_by_action_type_like',
		insight_post_stories_by_action_type_comment: 'insight_post_stories_by_action_type_comment',
		canonical: 'canonical',
		canonical_share: 'canonical_share',
		canonical_comment: 'canonical_comment',
		ia_published: 'ia_published',
		ia_import_status: 'ia_import_status',
		ia_all_views: 'ia_all_views',
		ia_all_view_durations_min: 'ia_all_view_durations_min',
		ia_all_view_durations_max: 'ia_all_view_durations_max',
		ia_all_view_durations_mean: 'ia_all_view_durations_mean',
		ia_all_view_durations_median: 'ia_all_view_durations_median',
		ia_all_view_durations_mode: 'ia_all_view_durations_mode',
		ia_all_view_durations_stdev: 'ia_all_view_durations_stdev',
		ia_all_view_durations_p25: 'ia_all_view_durations_p25',
		ia_all_view_durations_p50: 'ia_all_view_durations_p50',
		ia_all_view_durations_p75: 'ia_all_view_durations_p75',
		ia_all_view_durations_p95: 'ia_all_view_durations_p95',
		ia_all_scrolls_min: 'ia_all_scrolls_min',
		ia_all_scrolls_max: 'ia_all_scrolls_max',
		ia_all_scrolls_mean: 'ia_all_scrolls_mean',
		ia_all_scrolls_median: 'ia_all_scrolls_median',
		ia_all_scrolls_mode: 'ia_all_scrolls_mode',
		ia_all_scrolls_stdev: 'ia_all_scrolls_stdev',
		ia_all_scrolls_p25: 'ia_all_scrolls_p25',
		ia_all_scrolls_p50: 'ia_all_scrolls_p50',
		ia_all_scrolls_p75: 'ia_all_scrolls_p75',
		ia_all_scrolls_p95: 'ia_all_scrolls_p95',
	},
});

module.exports = (req, res, next) => getPostsLists({since: '2016-04-26'})
.then(result => (batchIdList(result.data)))
.then(idBatch => Promise.all(idBatch.map(executeQuery)))
.then(batchedResults => [].concat(...batchedResults))
.then(generateCsv)
.then(csv => {
	res.header('Content-Type', 'text/csv');
	res.send(csv);
})
.catch(next);