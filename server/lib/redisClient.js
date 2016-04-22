'use strict';

const url = require('url');
const redis = require('redis');
const denodeify = require('denodeify');

const denodeifyAll = proto => Object.keys(proto)
.forEach(key => (proto[`${key}Async`] = denodeify(proto[key])));

denodeifyAll(redis.RedisClient.prototype);
denodeifyAll(redis.Multi.prototype);

const redisParams = url.parse(process.env.REDIS_URL);
const redisClient = redis.createClient({
	port: redisParams.port,
	host: redisParams.hostname,
});

if(redisParams.auth) {
	redisClient.auth(redisParams.auth.split(':')[1]);
}

module.exports = redisClient;
