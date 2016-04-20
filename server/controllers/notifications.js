'use strict';

const notifications = require('../lib/notifications');
const database = require('../lib/database');
const articleModel = require('../models/article');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');
const ravenClient = require('../lib/raven');

const mode = require('../lib/mode').get();
const UPDATE_INTERVAL = 1 * 60 * 1000;
const OVERLAP_INTERVAL = 5 * 60 * 1000;

const groupNotifications = (notificationsList = []) => {
	const updates = [];
	const deletes = [];

	notificationsList.forEach(item => {
		switch(item.type) {
			case 'content-item-update':
				updates.push(item.data['content-item'].id);
				break;
			case 'content-item-deletion':
				deletes.push(item.data['content-item'].id);
				break;
			default:
				throw Error(`Unrecognised notification type: ${item.type}`);
		}
	});

	return {updates, deletes};
};

const getOnlyOld = (first, second) => first.filter(uuid => second.indexOf(uuid) === -1);

const getHistoricNotifications = ([{updates: firstUpdates, deletes: firstDeletes}, {updates: secondUpdates, deletes: secondDeletes}]) => ({
	updates: getOnlyOld(firstUpdates, secondUpdates),
	deletes: getOnlyOld(firstDeletes, secondDeletes),
});

const fetch = apiVersion => database.getLastNotificationCheck()
.then(lastCheck => {
	lastCheck = lastCheck || (Date.now() - UPDATE_INTERVAL);

	const startTime = new Date(lastCheck - OVERLAP_INTERVAL - UPDATE_INTERVAL).toISOString();
	const endTime = new Date(lastCheck - OVERLAP_INTERVAL).toISOString();

	return Promise.all([
		notifications.createNotificationsList(startTime, {apiVersion})
			.then(groupNotifications),
		notifications.createNotificationsList(endTime, {apiVersion})
			.then(groupNotifications),
	]);
})
.then(getHistoricNotifications);

const union = listofArrays => {
	const uuids = {};
	listofArrays.forEach(arr => arr.forEach(uuid => {
		uuids[uuid] = true;
	}));
	return Object.keys(uuids);
};

const merge = ([{updates: v1Updates, deletes: v1Deletes}, {updates: v2Updates, deletes: v2Deletes}]) => ({
	updates: union([v1Updates, v2Updates]),
	deletes: union([v1Deletes, v2Deletes]),
});

const getKnownArticles = uuids => Promise.all(uuids.map(uuid => ftApi.getCanonicalFromUuid(uuid)))
.then(canonicals => database.get(canonicals))
.then(articles => Object.keys(articles).reduce((valid, uuid) => {
	if(articles[uuid]) {
		valid.push(articles[uuid]);
	}
	return valid;
}, []));

const updateArticles = articles => Promise.all(
	articles.map(staleArticle => articleModel.update(staleArticle)
		.then(article => {
			const sentToFacebook = (article.fbRecords[mode] && !article.fbRecords[mode].nullRecord);
			console.log(`${Date()}: NOTIFICATIONS API: processing known article [${article.uuid}], mode [${mode}], sentToFacebook [${sentToFacebook}]`);
			if(sentToFacebook) {
				return transform(article)
					.then(({html, warnings}) => fbApi.post({html, published: article.fbRecords[mode].published})
						.then(({id}) => articleModel.setImportStatus({
							article,
							id,
							warnings,
							published: article.fbRecords[mode].published,
							username: 'daemon',
							type: 'notifications-api',
						}))
					);
			}
		})
		.then(() => staleArticle.uuid)
	)
);

const deleteArticles = articles => Promise.all(
	articles.map(staleArticle => fbApi.delete({canonical: staleArticle.canonical})
		.then(() => articleModel.setImportStatus({article: staleArticle, username: 'daemon', type: 'notifications-delete'}))
		.then(() => staleArticle.uuid)
	)
);

const poller = () => Promise.all([
	fetch(1),
	fetch(2),
])
.then(merge)
.then(merged => Promise.all([
	getKnownArticles(merged.updates),
	getKnownArticles(merged.deletes),
]))
.then(([updates, deletes]) => Promise.all([
	updateArticles(updates),
	deleteArticles(deletes),
]))
.then(([updated, deleted]) => {
	if(updated.length) {
		console.log(`${Date()}: NOTIFICATIONS API: updated articles ${updated.join(', ')}`);
	} else {
		console.log(`${Date()}: NOTIFICATIONS API: no articles to update`);
	}

	if(deleted.length) {
		console.log(`${Date()}: NOTIFICATIONS API: deleted articles ${deleted.join(', ')}`);
	} else {
		console.log(`${Date()}: NOTIFICATIONS API: no articles to delete`);
	}

	return database.setLastNotificationCheck(Date.now());
})
.catch(e => {
	console.error(e.stack || e);
	if(mode === 'production') {
		ravenClient.captureException(e, {tags: {from: 'notifications'}});
	}
})
.then(() => setTimeout(poller, UPDATE_INTERVAL));

module.exports.init = () => {
	poller();
};
