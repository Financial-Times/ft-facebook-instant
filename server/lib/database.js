'use strict';

const client = require('./redisClient');
const DbParseException = require('./database/parseException');

const KEY_COUNT = 1; // See extractDetails()
const CAPI_TTL = 60 * 60 * 24;

const types = {
	canonical: 'string',
	uuid: 'string',
	title: 'string',
	date_editorially_published: 'integer',
	date_record_updated: 'integer',
	import_meta: 'json',
	notifications_last_poll: 'integer',
};

const format = (type, val) => {
	switch(type) {
		case 'string':
			return String(val);
		case 'integer':
			return val ? parseInt(val, 10) : 0;
		case 'json':
			try{
				return JSON.parse(val);
			} catch(e) {
				throw new DbParseException(e.message);
			}
		default:
			throw Error(`Can't format unrecognised type [${type}]`);
	}
};

const formatObj = obj => {
	let key;
	for(key in obj) {
		if(obj.hasOwnProperty(key)) {
			const type = types[key];
			if(!type) throw Error(`Can't format unrecognised key [${key}]`);
			obj[key] = format(type, obj[key]);
		}
	}
	return obj;
};

const extractDetails = replies => {
	if(!Array.isArray(replies) || replies.length < KEY_COUNT) {
		return null;
	}

	const [article] = replies;

	if(article && typeof article === 'object') {
		return formatObj(article);
	}

	return null;
};

const extractAllDetails = (replies) => {
	const articles = [];
	while(replies.length) {
		try{
			articles.push(extractDetails(replies.splice(0, KEY_COUNT)));
		} catch(e) {
			if(e.type === 'DbParseException') {
				// Ignore and remove results from list
			}
			throw e;
		}
	}
	return articles;
};

const addGetToMulti = (multi, canonical) => multi
	.hgetall(`article:${canonical}`);

const getMulti = canonicals => {
	if(!canonicals) return Promise.resolve([]);

	const multi = client.multi();

	canonicals.forEach(canonical => {
		addGetToMulti(multi, canonical);
	});

	return multi
		.execAsync()
		.then(replies => extractAllDetails(replies));
};

const set = article => client.multi()
	.hmset(`article:${article.canonical}`, {
		uuid: article.uuid,
		title: article.title,
		canonical: article.canonical,
		date_editorially_published: article.date_editorially_published,
		date_record_updated: article.date_record_updated,
		import_meta: JSON.stringify(article.import_meta),
	})
	.zadd('articles', article.date_record_updated, article.canonical)
	.execAsync()
	.then(replies => article);

const del = canonical => client.multi()
	.del(`article:${canonical}`)
	.zrem('articles', canonical)
	.execAsync();

const get = canonical => addGetToMulti(client.multi(), canonical)
.execAsync()
.then(extractDetails)
.catch(e => {
	if(e.type === 'DbParseException') {
		return del(canonical)
			.then(() => null);
	}
	throw e;
});

const list = () => {
	const now = Date.now();
	const then = 0;

	return client.zrevrangebyscoreAsync('articles', now, then)
		.then(getMulti);
};

const wipe = () => client.flushallAsync();

const setLastNotificationCheck = timestamp => client.setAsync('notifications:last_poll', timestamp);

const getLastNotificationCheck = () => client.getAsync('notifications:last_poll')
.then(timestamp => format(types.notifications_last_poll, timestamp));

const setCanonical = (key, canonical) => client.multi()
.set(`canonical_map:${key}`, canonical)
.sadd(`canonical_keys:${canonical}`, key)
.execAsync()
.then(() => canonical);

const getCanonical = key => client.getAsync(`canonical_map:${key}`);

const purgeCanonical = canonical => client.smembersAsync(`canonical_keys:${canonical}`)
.then(keys => {
	const multi = client.multi();

	keys.forEach(key => {
		multi.del(`canonical_map:${key}`);
	});

	multi.del(`canonical_keys:${canonical}`);
	return multi.execAsync();
});

const setCapi = (id, capi) => client.setAsync(`capi:${id}`, JSON.stringify(capi), 'EX', CAPI_TTL);

const getCapi = id => client.getAsync(`capi:${id}`)
.then(capi => {
	try{
		return JSON.parse(capi);
	} catch(e) {
		throw Error(`Failed to parse JSON from CAPI blob: [${capi}]`);
	}
});

const purgeCapi = id => client.delAsync(`capi:${id}`);

const wipeInsights = () => client.delAsync('insights');

const getLastInsight = () => client.zrevrangeAsync('insights', 0, 1)
.then(insight => insight && insight[0] && JSON.parse(insight[0]) || null);

const setInsight = (timestamp, data) => client.multi()
	.zremrangebyscore('insights', timestamp, timestamp)
	.zadd('insights', timestamp, JSON.stringify({timestamp, data}))
	.execAsync();

module.exports = {
	get(canonicals) {
		if(Array.isArray(canonicals)) {
			return getMulti(canonicals);
		}
		return get(canonicals);
	},
	set,
	delete: del,
	list,
	wipe,
	setLastNotificationCheck,
	getLastNotificationCheck,
	getCanonical,
	setCanonical,
	purgeCanonical,
	getCapi,
	setCapi,
	purgeCapi,
	getLastInsight,
	setInsight,
	wipeInsights,
};
