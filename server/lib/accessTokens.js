'use strict';

const redisClient = require('./redisClient');

let i = 0;

exports.add = token => redisClient.saddAsync('meta:access_tokens', token);

exports.count = () => redisClient.smembersAsync('meta:access_tokens')
.then(tokens => tokens.length);

exports.get = () => redisClient.smembersAsync('meta:access_tokens')
.then(tokens => {
	const token = tokens[i];
	i = (i + 1) % tokens.length;
	return token;
});

exports.remove = token => redisClient.sremAsync('meta:access_tokens', token);

exports.add(process.env.FB_PAGE_ACCESS_TOKEN)
  .then(() => console.log(`${new Date()}:`, 'ACCESS TOKENS:', 'Added initial page token to Redis'));
