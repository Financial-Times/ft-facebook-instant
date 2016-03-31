'use strict';

const client = require('./redisClient');
const KEY_COUNT = 1; // See extractDetails()
const LIST_AGE = 7 * 24 * 60 * 60 * 1000; // See list()

const types = {

	// article:{uuid} - Hash of article metadata: {uuid}, {title}, {date_editorially_published},
	//	{date_record_updated}
	uuid: 'string',
	title: 'string',
	canonical: 'string',
	date_editorially_published: 'integer',
	date_record_updated: 'integer',

	// articles: 'string', // articles - Sorted Set of known article uuids, scored by {date_record_updated}
	notifications_last_poll: 'integer', // notifications:last_poll - string timestamp
};

const format = (type, val) => {
	switch(type) {
		case 'string':
			return String(val);
		case 'integer':
			return val ? parseInt(val, 10) : 0;
		case 'array-of-integers':
			return val.map(s => format('integer', val));
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

const extractAllDetails = (uuids, replies) => {
	const articles = {};
	uuids.forEach(uuid => {
		const replySet = replies.splice(0, KEY_COUNT);
		articles[uuid] = extractDetails(replySet);
	});
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
		.then(replies => extractAllDetails(uuids, replies));
};

const set = article => client.multi()
	.hmset(`article:${article.uuid}`, article)
	.zadd('articles', article.date_record_updated, article.uuid)
	.execAsync()
	.then(replies => article);

// const publish = (mode, uuid) => {
// 	const timestamp = Date.now();

// 	return client.multi()
// 		.execAsync()
// 		.then(replies => {
// 			const [articleReply, publishedReply] = replies;
// 			return {articleReply, publishedReply};
// 		});
// };

// const unpublish = (mode, uuid) => client.multi()
// .hdel(`article:${uuid}`, `date_published_${mode}`)
// .zrem(`date_published_${mode}`, uuid)
// .execAsync()
// .then(replies => {
// 	const [articleReply, publishedReply] = replies;
// 	return {articleReply, publishedReply};
// });

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
	// publish,
	// unpublish,
	setLastNotificationCheck,
	getLastNotificationCheck,
};
