'use strict';

const redisClient = require('./redisClient');

let i = 0;

exports.add = (userId, token) => redisClient.hsetAsync('meta:access_tokens_hash', userId, token);

exports.count = () => redisClient.hlenAsync('meta:access_tokens_hash');


exports.get = () => redisClient.hvalsAsync('meta:access_tokens_hash')
.then(tokens => {
	const token = tokens[i];
	i = (i + 1) % tokens.length;
	return token;
});

exports.remove = userId => redisClient.hdelAsync('meta:access_tokens_hash', userId);

exports.add(process.env.FB_INITIAL_USER_ID, process.env.FB_PAGE_ACCESS_TOKEN)
  .then(() => console.log(`${new Date()}:`, 'ACCESS TOKENS:', 'Added initial page token to Redis'));

// TODO:MB:20160415 delete next week
redisClient.existsAsync('meta:access_tokens').then(exists => {
	if(exists) {
		return redisClient.delAsync('meta:access_tokens').then(() => 'Removed old access tokens key');
	}

	return 'No old access tokens key to remove';
}).then(msg => console.log(`${new Date()}:`, 'ACCESS TOKENS:', msg));
