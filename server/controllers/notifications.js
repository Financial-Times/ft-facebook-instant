'use strict';

const notifications = require('../lib/notifications');
const database = require('../lib/database');
const articleModel = require('../models/article');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');

const mode = require('../lib/mode').get();
const UPDATE_INTERVAL = 1 * 60 * 1000;

const update = apiVersion => database.getLastNotificationCheck()
.then(lastCheck => {
	lastCheck = new Date(lastCheck || (Date.now() - UPDATE_INTERVAL)).toISOString();
	return notifications.createNotificationsList(lastCheck, {apiVersion});
})
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

const getKnownArticles = uuids => Promise.all(uuids.map(uuid => ftApi.getCanonicalFromUuid(uuid)))
.then(canonicals => database.get(canonicals))
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
.then(knownArticles => Promise.all(knownArticles.map(knownArticle => articleModel.update(knownArticle)
	.then(article => {
		if(article.fbRecords[mode]) {
			return transform(article)
				.then(html => fbApi.post({html, published: article.fbRecords[mode].published}))
				.then(({id}) => articleModel.setImportStatus({article, id, type: 'notifications-api'}));
		}
	})
))
	.then(() => {
		if(knownArticles.length) {
			console.log(`${Date()}: updated articles ${knownArticles.map(article => article.uuid)}`);
		} else {
			console.log(`${Date()}: no articles to update`);
		}

		return database.setLastNotificationCheck(Date.now());
	})
)
.catch(e => console.log(e)); // TODO: error reporting

module.exports.init = () => {
	poller();
	setInterval(poller, UPDATE_INTERVAL);
};
