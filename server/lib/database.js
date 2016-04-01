'use strict';

const client = require('./redisClient');
const KEY_COUNT = 1; // See extractDetails()
const LIST_AGE = 7 * 24 * 60 * 60 * 1000; // See list()

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
			return JSON.parse(val);
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
		articles.push(extractDetails(replies.splice(0, KEY_COUNT)));
	}
	return articles;
};

const addGetToMulti = (multi, uuid) => multi
	.hgetall(`article:${uuid}`);

const get = uuid => addGetToMulti(client.multi(), uuid)
.execAsync()
.then(extractDetails);

const getMulti = uuids => {
	if(!uuids) return Promise.resolve([]);

	const multi = client.multi();

	uuids.forEach(uuid => {
		addGetToMulti(multi, uuid);
	});

	return multi
		.execAsync()
		.then(replies => extractAllDetails(replies));
};

const set = article => client.multi()
	.hmset(`article:${article.uuid}`, {
		uuid: article.uuid,
		title: article.title,
		canonical: article.canonical,
		date_editorially_published: article.date_editorially_published,
		date_record_updated: article.date_record_updated,
		import_meta: JSON.stringify(article.import_meta),
	})
	.zadd('articles', article.date_record_updated, article.uuid)
	.execAsync()
	.then(replies => article);

const list = () => {
	const now = Date.now();
	const then = now - LIST_AGE;

	return client.zrangebyscoreAsync('articles', then, now)
		.then(getMulti);
};

const wipe = () => client.flushallAsync();

const setLastNotificationCheck = timestamp => client.setAsync('notifications:last_poll', timestamp);

const getLastNotificationCheck = () => client.getAsync('notifications:last_poll')
.then(timestamp => format(types.notifications_last_poll, timestamp));

module.exports = {
	get(uuids) {
		if(Array.isArray(uuids)) {
			return getMulti(uuids);
		}
		return get(uuids);
	},
	set,
	list,
	wipe,
	setLastNotificationCheck,
	getLastNotificationCheck,
};
