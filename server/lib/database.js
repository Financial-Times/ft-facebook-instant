'use strict';

const client = require('./redisClient');
const maxImpressionCount = 1;
const KEY_COUNT = 7; // See extractDetails


const extractDetails = replies => {
	if(!Array.isArray(replies) || replies.length < 7) {
		return null;
	}

	const [article, datePublishedDevelopment, datePublishedProduction,
		dateImportedDevelopment, dateImportedProduction, developmentImpressions,
		productionImpressions] = replies;

	if(article && typeof article === 'object') {
		return Object.assign(article, {
			date_published_development: datePublishedDevelopment,
			date_published_production: datePublishedProduction,
			date_imported_development: dateImportedDevelopment,
			date_imported_production: dateImportedProduction,
			development_impressions: developmentImpressions,
			production_impressions: productionImpressions,
		});
	}

	return null;
};

const extractAllDetails = (uuids, replies) => {
	const articles = {};
	uuids.forEach(uuid => {
		const replySet = replies.splice(0, KEY_COUNT);
		articles[uuid] = extractDetails(replySet);
	});
	return articles;
};

const addGetToMulti = (multi, uuid) => multi
	.hgetall(`article:${uuid}`)
	.zscore('date_published_development', uuid)
	.zscore('date_published_production', uuid)
	.zscore('date_imported_development', uuid)
	.zscore('date_imported_production', uuid)
	.lrange(`article:${uuid}:impressions:development`, 0, -1)
	.lrange(`article:${uuid}:impressions:production`, 0, -1);

const getMulti = uuids => {
	if(!uuids) return Promise.resolve([]);

	const multi = client.multi();

	uuids.forEach(uuid => {
		addGetToMulti(multi, uuid);
	});

	return multi
		.execAsync()
		.then(replies => extractAllDetails(uuids, replies));
};

const update = article => {
	article.date_record_updated = Date.now();

	return client.multi()
		.hmset(`article:${article.uuid}`,
			'uuid', article.uuid,
			'title', article.title,
			'date_editorially_published', article.date_editorially_published,
			'date_record_updated', article.date_record_updated
		)
		.zadd('articles', article.date_record_updated, article.uuid)
		.execAsync()
		.then(replies => article);
};

const publish = (feedType, uuid) => {
	const timestamp = Date.now();

	return client.multi()
		.hset(`article:${uuid}`, `date_published_${feedType}`, timestamp)
		.zadd(`date_published_${feedType}`, timestamp, uuid)
		.execAsync()
		.then(replies => {
			const [articleReply, publishedReply] = replies;
			return {articleReply, publishedReply};
		});
};

const unpublish = (feedType, uuid) => client.multi()
.hdel(`article:${uuid}`, `date_published_${feedType}`)
.zrem(`date_published_${feedType}`, uuid)
.del(`article:${uuid}:impressions:${feedType}`)
.execAsync()
.then(replies => {
	const [articleReply, publishedReply] = replies;
	return {articleReply, publishedReply};
});

const list = () => {
	const now = Date.now();
	const then = now - (7 * 24 * 60 * 60 * 1000);

	return client.zrangebyscoreAsync('articles', then, now)
		.then(getMulti);
};

const feed = feedType => {
	const now = Date.now();
	const then = now - (24 * 60 * 60 * 1000);

	return client.zrangebyscoreAsync(`date_published_${feedType}`, then, now)
		.then(getMulti);
};

const impression = (feedType, uuid) => {
	const now = Date.now();
	return client.lpushAsync(`article:${uuid}:impressions:${feedType}`, now)
		.then(replies => {
			const count = [replies];
			if(count >= maxImpressionCount) {
				return client.multi()
					.zadd(`date_imported_${feedType}`, now, uuid)
					.zrem(`date_published_${feedType}`, uuid)
					.hset(`article:${uuid}`, `date_imported_${feedType}`, now)
					.del(`article:${uuid}:impressions:${feedType}`)
					.execAsync()
					.then(() => count);
			}
			return count;
		});
};

const wipe = () => client.flushallAsync();

const get = uuid => addGetToMulti(client.multi(), uuid)
.execAsync()
.then(extractDetails);

module.exports = {
	get(uuids) {
		if(Array.isArray(uuids)) {
			return getMulti(uuids);
		}
		return get(uuids);
	},
	update,
	list,
	wipe,
	publish,
	unpublish,
	feed,
	impression,
};
