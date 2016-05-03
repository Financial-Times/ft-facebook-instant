'use strict';

const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');
const database = require('../lib/database');
const numbers = require('numbers');
const moment = require('moment');
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

const getAggregationStatistics = values => ({
	min: values[0],
	max: values[values.length - 1],
	mean: Math.round(numbers.statistic.mean(values) * 100) / 100,
	median: numbers.statistic.median(values),
	mode: numbers.statistic.mode(values),
	stdev: Math.round(numbers.statistic.standardDev(values) * 100) / 100,
	p25: numbers.statistic.quantile(values, 25, 100),
	p50: numbers.statistic.quantile(values, 50, 100),
	p75: numbers.statistic.quantile(values, 75, 100),
	p95: numbers.statistic.quantile(values, 95, 100),
});

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

	return Object.assign(aggregations, getAggregationStatistics(values));
};

const flattenIaMetrics = (post, flat) => {
	Object.keys(iaMetricTypes).forEach(key => {
		const metric = post.canonical && post.canonical.instant_article && post.canonical.instant_article[`metrics_${key}`];
		let aggregations;
		switch(iaMetricTypes[key]) {
			case 'day':
				flat[`ia_${key}`] = metric ? metric.data.reduce((total, item) => (total + parseInt(item.value, 10)), 0) : 0;
				break;
			case 'week':
				aggregations = metric ? aggregateMetricBreakdowns(metric.data) : getAggregationStatistics([0]);
				Object.keys(aggregations).forEach(aggregation => {
					flat[`ia_${key}_${aggregation}`] = aggregations[aggregation];
				});
				break;
			default:
				throw Error(`Unexpected Instant Article metric key [${key}]`);
		}
	});
};

const getEarliestIaView = post => {
	if(!post.canonical.instant_article.metrics_all_views) return null;

	const earliest = post.canonical.instant_article.metrics_all_views.data
		.map(item => new Date(item.time).getTime())
		.sort((a, b) => a - b)
		[0];

	return moment.utc(earliest)
		.format();
};

const getUuid = canonical => database.getCapi(canonical)
.then(cached => cached || ftApi.fetchByCanonical(canonical))
.then(article => article && article.id || null)
.catch(() => null);

const flattenPost = post => Promise.resolve()
.then(() => {
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

		// Default values
		canonical: null,
		uuid: null,
		canonical_share: 0,
		canonical_comment: 0,
		ia_published: 0,
		ia_earliest_views: null,
		ia_import_status: null,
	};

	flat.shares = post.shares && post.shares.count;
	flat.likes = post.likes && post.likes.summary.total_count;
	flat.comments = post.comments && post.comments.summary.total_count;

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
			flat.ia_earliest_views = getEarliestIaView(post);
			flat.ia_import_status = post.canonical.instant_article.most_recent_import_status &&
				post.canonical.instant_article.most_recent_import_status.status;
		}
	}

	flattenIaMetrics(post, flat);
	return flat;
})
.then(flat => {
	if(!flat.canonical) return flat;

	return getUuid(flat.canonical)
		.then(uuid => Object.assign(flat, {uuid}));
});

const processResults = ([posts, links, canonicals]) => Object.keys(posts).map(id => {
	const post = posts[id];

	if(post.link && links[post.link] && links[post.link].og_object && links[post.link].og_object.url) {
		post.canonical = canonicals[links[post.link].og_object.url];
	}

	const insights = post.insights.data;
	post.insights = {};
	insights.forEach(item => (post.insights[item.name] = item));

	return post;
});

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
});

module.exports = (req, res, next) => getPostsLists({since: '2016-04-26'})
.then(result => (batchIdList(result.data)))
.then(idBatch => Promise.all(idBatch.map(executeQuery)))
.then(batchedResults => [].concat(...batchedResults))

.then(posts => Promise.all(posts.map(flattenPost)))
.then(generateCsv)
.then(csv => {
	res.header('Content-Type', 'text/csv');
	res.send(csv);
})
.catch(next);
