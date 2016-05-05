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
const EXPLAINER_ROW = true;

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

const insightsMetricsKeys = {
	post_impressions: 'The number of impressions for your Page post',
	post_impressions_unique: 'The number of people who saw your Page post',
	post_impressions_paid: 'The number of impressions for your Page post in an Ad or Sponsored Story',
	post_impressions_paid_unique: 'The number of people who saw your Page post in an Ad or Sponsored Story',
	post_impressions_fan: 'The number of impressions for your Page post by people who have liked your Page',
	post_impressions_fan_unique: 'The number of people who have like your Page who saw your Page post',
	post_impressions_fan_paid: 'The number of impressions for your Page post by people who like your Page in an Ad or Sponsored Story',
	post_impressions_fan_paid_unique: 'The number of people who have like your Page and saw your Page post in an Ad or Sponsored Story',
	post_impressions_organic: 'The number of impressions of your post in Newsfeed, Ticker, or on your Page\'s Wall',
	post_impressions_organic_unique: 'The number of people who saw your post in their Newsfeed or Ticker or on your Page\'s Wall',
	post_impressions_viral: 'The number of impressions of your Page post in a story generated by a friend',
	post_impressions_viral_unique: 'The number of people who saw your page post in a story from a friend',
	post_impressions_by_story_type: 'The number of times this post was seen via a story published by a friend of the person viewing the post',
	post_impressions_by_story_type_unique: 'The number of people who saw your page post in a story from a friend, by story type',
	post_consumptions: 'The number of times people clicked on anywhere in your posts without generating a story',
	post_consumptions_unique: 'The number of people who clicked anywhere in your post without generating a story',
	post_consumptions_by_type: 'The number of times people clicked on anywhere in your posts without generating a story, by consumption type',
	post_consumptions_by_type_unique: 'The number of people who clicked anywhere in your post without generating a story, by consumption type',
	post_engaged_users: 'The number of people who clicked anywhere in your posts',
	post_negative_feedback: 'The number of times people took a negative action in your post (e.g. hid it)',
	post_negative_feedback_unique: 'The number of people who took a negative action in your post (e.g., hid it)',
	post_negative_feedback_by_type: 'The number of times people took a negative action in your post broken down by type',
	post_negative_feedback_by_type_unique: 'The number of people who took a negative action in your post broken down by type',
	post_engaged_fan: 'People who have liked your page and engaged with your post.',
	post_fan_reach: 'Post reach by people who like your page.',
};

const insightsMetricsKeyTypes = {
	post_impressions_by_story_type: {
		other: true,
	},
	post_impressions_by_story_type_unique: {
		other: true,
	},
	post_consumptions_by_type: {
		'other clicks': true,
		'link clicks': true,
		'video play': true,
		'photo view': true,
	},
	post_consumptions_by_type_unique: {
		'other clicks': true,
		'link clicks': true,
		'video play': true,
		'photo view': true,
	},
	post_negative_feedback_by_type: {
		'hide all clicks': true,
		'hide clicks': true,
		'report spam clicks': true,
		'unlike page clicks': true,
	},
	post_negative_feedback_by_type_unique: {
		'hide all clicks': true,
		'hide clicks': true,
		'report spam clicks': true,
		'unlike page clicks': true,
	},
};

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
	const insightsQuery = `insights.metric(${Object.keys(insightsMetricsKeys).join(',')}){${insightsKeys.join(',')}}`;
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
		ia_published: 0,
		ia_earliest_views: null,
		ia_import_status: null,
	};

	flat.post_shares = post.shares && post.shares.count;
	flat.post_likes = post.likes && post.likes.summary.total_count;
	flat.post_comments = post.comments && post.comments.summary.total_count;

	Object.keys(insightsMetricsKeys).forEach(insightKey => {
		const insight = post.insights[insightKey];
		if(insight) {
			if(insightsMetricsKeyTypes[insightKey]) {
				Object.keys(insightsMetricsKeyTypes[insightKey]).forEach(valueKey => {
					flat[`insight_${insightKey}_${valueKey}`] = insight.values[0].value[valueKey] || 0;
				});
			} else {
				flat[`insight_${insightKey}`] = insight.values[0].value || 0;
			}
		} else {
			if(insightsMetricsKeyTypes[insightKey]) {
				Object.keys(insightsMetricsKeyTypes[insightKey]).forEach(valueKey => {
					flat[`insight_${insightKey}_${valueKey}`] = 0;
				});
			} else {
				flat[`insight_${insightKey}`] = 0;
			}
		}
	});

	if(post.canonical) {
		flat.canonical = post.canonical.id;
		flat.canonical_share = post.canonical.share.share_count;

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

const getColumns = () => {
	let columns = {
		id: 'id',
		type: 'type',
		name: 'name',
		message: 'message',
		description: 'description',
		created_time: 'created_time',
		updated_time: 'updated_time',
		is_published: 'is_published',
		link: 'link',
		canonical: 'canonical',
		uuid: 'uuid',
		post_shares: 'post_shares',
		post_likes: 'post_likes',
		post_comments: 'post_comments',
		canonical_share: 'canonical_share',
	};

	Object.keys(insightsMetricsKeys).forEach(key => {
		if(insightsMetricsKeyTypes[key]) {
			Object.keys(insightsMetricsKeyTypes[key]).forEach(type => {
				const escapedType = type.replace(/\s/g, '_');
				columns[`insight_${key}_${type}`] = `insight_${key}_${escapedType}`;
			});
		} else {
			columns[`insight_${key}`] = `insight_${key}`;
		}
	});

	columns = Object.assign(columns, {
		ia_published: 'ia_published',
		ia_earliest_views: 'ia_earliest_views',
		ia_import_status: 'ia_import_status',
	});

	Object.keys(iaMetricTypes).forEach(key => {
		switch(iaMetricTypes[key]) {
			case 'day':
				columns[`ia_${key}`] = key;
				break;
			case 'week':
				['min', 'max', 'mean', 'median', 'mode', 'stdev', 'p25', 'p50', 'p75', 'p95'].forEach(type => {
					columns[`ia_${key}_${type}`] = `${key}_${type}`;
				});
				break;
			default:
				throw Error(`Unexpected Instant Article metric key [${key}]`);
		}
	});

	return columns;
};

const addExplainerRow = data => {
	const explainer = {
		id: 'key',
	};

	Object.keys(insightsMetricsKeys).forEach(key => {
		if(insightsMetricsKeyTypes[key]) {
			Object.keys(insightsMetricsKeyTypes[key]).forEach(type => {
				explainer[`insight_${key}_${type}`] = `${insightsMetricsKeys[key]}`;
			});
		} else {
			explainer[`insight_${key}`] = `${insightsMetricsKeys[key]}`;
		}
	});
	data.unshift(explainer);
};

const generateCsv = data => {
	if(EXPLAINER_ROW) {
		addExplainerRow(data);
	}

	return csvStringify(data, {
		header: true,
		columns: getColumns(),
	});
};

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
