'use strict';

const url = require('url');
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis);

const redisParams = url.parse(process.env.REDIS_URL);
const client = redis.createClient({
	port: redisParams.port,
	host: redisParams.hostname,
});

client.auth(redisParams.auth.split(':')[1]);


module.exports.fetch = uuid => client.hgetallAsync(`article:${uuid}`);

module.exports.list = () => client.zrangeAsync('articles', 0, -1)
.then(articles => {
	console.log('Article UUIDs', articles);
	const promises = articles.map(uuid => client.hgetallAsync(`article:${uuid}`));
	return Promise.all(promises)
		.then(articles);
});

module.exports.update = (article) => {
	console.log('Database will update', article);

	return client.batch()

		// Article Hash
		.hmset(`article:${article.uuid}`,
			'uuid', article.uuid,
			'title', article.title,
			'date_published', article.date_published,
			'date_updated', article.date_updated,
			'feeds:development:published', article.feeds.development.published,
			'feeds:production:published', article.feeds.production.published
		)

		// Articles Ordered Set
		.zadd('articles', article.date_updated, article.uuid)

		// Article page loads (debug only)
		.hincrby(`article:${article.uuid}`, 'loads', 1)

		.execAsync()
		.then(replies => console.log('replies', replies));
};

module.exports.wipe = () => client.flushallAsync();
