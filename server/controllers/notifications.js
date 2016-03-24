'use strict';

const notifications = require('../lib/notifications');
const database = require('../lib/database');
const articleModel = require('../models/article');

const UPDATE_INTERVAL = 100 * 60 * 1000;

const update = apiVersion => notifications.createNotificationsList(
	new Date(Date.now() - UPDATE_INTERVAL).toISOString(),
	{apiVersion}
)
.then(notificationsList => notificationsList
	.filter(item => item.type === 'content-item-update')
	.map(item => item.data['content-item'].id)
);

const union = lists => {
	const uuids = {};
	lists.forEach(list => list.forEach(uuid => {
		uuids[uuid] = true;
	}));
	return Object.keys(uuids);
};

const getKnownArticles = uuids => database.get(uuids)
.then(articles => Object.keys(articles).reduce((valid, uuid) => {
	if(articles[uuid]) {
		valid.push(articles[uuid]);
	}
	return valid;
}, []));

const poller = () => Promise.all([
	update(1),
	update(2),
])
.then(union)
.then(getKnownArticles)
.then(articles => Promise.all(articles.map(article => articleModel.update(article)))
	.then(() => {
		console.log(`${Date()}: updated articles ${articles.map(article => article.uuid)}`);
	})
)
.catch(e => console.log(e)); // TODO: error reporting

module.exports.init = () => {
	poller();
	setInterval(poller, UPDATE_INTERVAL);
};
