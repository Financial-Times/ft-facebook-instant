'use strict';

const denodeify = require('denodeify');
const redis = require('redis');

const promisify = (obj) => {
	Object.keys(obj).forEach(key => (obj[`${key}Async`] = denodeify(obj[key])));
};

promisify(redis.RedisClient.prototype);

const client = redis.createClient({
	host: 'keen-rosewood-5711.redisgreen.net',
	port: '11042',
	password: '73d5c959b48e48f68f2f64bfd49a9375',
	url: 'redis://x:73d5c959b48e48f68f2f64bfd49a9375@keen-rosewood-5711.redisgreen.net:11042/',
});

client.getAsync('foo')
.then(res => console.log('done', res));
