'use strict';

const url = require('url');
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis);

const redisParams = url.parse(process.env.REDIS_URL);
const redisClient = redis.createClient({
	port: redisParams.port,
	host: redisParams.hostname,
});

redisClient.auth(redisParams.auth.split(':')[1]);

module.exports = redisClient;
