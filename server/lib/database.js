'use strict';

const client = require('./redisClient');
const RichError = require('./richError');

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
	ab_last_poll: 'integer',
	linkpost: 'json',
	abtestdata: 'json',
};

const format = (type, val) => {
	switch(type) {
		case 'string':
			return String(val);
		case 'integer':
			return val ? parseInt(val, 10) : 0;
		case 'json':
			try {
				return JSON.parse(val);
			} catch(e) {
				throw new RichError(e.message, {type: 'FbApiTimeoutException'});
			}
		default:
			throw new RichError('Can\'t format unrecognised type', {extra: {formatType: type}});
	}
};

const formatObj = obj => {
	let key;
	for(key in obj) {
		if(obj.hasOwnProperty(key)) {
			const type = types[key];
			if(!type) throw new RichError('Can\'t format unrecognised key', {extra: {formatKey: key}});
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
		try {
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

const setLastABCheck = timestamp => client.setAsync('ab:last_poll', timestamp);

const getLastABCheck = () => client.getAsync('ab:last_poll')
.then(timestamp => format(types.ab_last_poll, timestamp));

const setAbTestStats = (url, data) => client.setAsync(`abtestdata:${url}`, JSON.stringify(data));

const getAbTestStats = url => client.getAsync(`abtestdata:${url}`).then(post => format(types.abtestdata, post));

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
	try {
		return JSON.parse(capi);
	} catch(e) {
		throw new RichError('Failed to parse JSON from CAPI blob', {extra: {capi}});
	}
});

const purgeCapi = id => client.delAsync(`capi:${id}`);

const wipeLastInsight = () => client.delAsync('lastinsight');

const setLastInsight = (timestamp, data) => client.setAsync('lastinsight', JSON.stringify({timestamp, data}));

const getLastInsight = () => client.getAsync('lastinsight')
.then(insight => insight && JSON.parse(insight) || null);

const getFBLinkPost = url => client.getAsync(`linkpost:${url}`).then(post => format(types.linkpost, post));
const setFBLinkPost = (url, data) => client.setAsync(`linkpost:${url}`, JSON.stringify(data));
const getFBLinkPosts = () => client.keysAsync('linkpost:*').then(
	keys => (keys.length && client.mgetAsync(keys) || [])
).then(posts => posts.map(post => format(types.linkpost, post)));

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
	setLastABCheck,
	getLastABCheck,
	getCanonical,
	setCanonical,
	purgeCanonical,
	getCapi,
	setCapi,
	purgeCapi,
	setLastInsight,
	getLastInsight,
	wipeLastInsight,
	getFBLinkPost,
	getFBLinkPosts,
	setFBLinkPost,
	setAbTestStats,
	getAbTestStats,
};
