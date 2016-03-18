'use strict';

const client = require('./redisClient');
const maxImpressionCount = 4;


const extractDetails = replies => {
	if(!Array.isArray(replies) || replies.length < 7) {
		return null;
	}

	const article = replies.shift();
	if(!article) {
		return null;
	}

	article.date_published_development = replies.shift();
	article.date_published_production = replies.shift();
	article.date_imported_development = replies.shift();
	article.date_imported_production = replies.shift();
	article.development_impressions = replies.shift();
	article.production_impressions = replies.shift();
	return article;
};

const extractAllDetails = (uuids, replies) => {
	const articles = {};
	uuids.forEach(uuid => {
		articles[uuid] = extractDetails(replies);
	});
	return articles;
};

const get = (multi, uuid) => multi
	.hgetall(`article:${uuid}`)
	.zscore('date_published_development', uuid)
	.zscore('date_published_production', uuid)
	.zscore('date_imported_development', uuid)
	.zscore('date_imported_production', uuid)
	.lrange(`article:${uuid}:impressions:development`, 0, -1)
	.lrange(`article:${uuid}:impressions:production`, 0, -1);

const getMulti = uuids => {
	console.log('List of uuids', uuids);
	if(!uuids) return Promise.resolve([]);

	const multi = client.multi();

	uuids.forEach(uuid => {
		get(multi, uuid);
	});

	return multi
		.execAsync()
		.then(replies => extractAllDetails(uuids, replies))
		.then(articles => {
			console.log('List of articles', articles);
			return articles;
		});
};

const update = article => {
	article.date_updated = Date.now();

	return client.multi()
		.hmset(`article:${article.uuid}`,
			'uuid', article.uuid,
			'title', article.title,
			'date_editorially_published', article.date_editorially_published,
			'date_updated', article.date_updated
		)
		.zadd('articles', article.date_updated, article.uuid)
		.execAsync()
		.then(replies => {
			const [articlereply, articles] = replies;
			console.log('Update', {articlereply, articles});
			return article;
		});
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
			console.log(`Impression count for ${uuid} in ${feedType}: ${count}`);
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

module.exports = {
	get(uuid) {
		return get(client.multi(), uuid)
			.execAsync()
			.then(extractDetails);
	},
	update,
	list,
	wipe,
	publish,
	unpublish,
	feed,
	impression,
};
