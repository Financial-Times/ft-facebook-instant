'use strict';

const notificationsApi = require('../lib/notifications');
const database = require('../lib/database');
const articleModel = require('../models/article');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');
const ravenClient = require('../lib/raven');
const promiseLoopInterval = require('@quarterto/promise-loop-interval');

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

const fetch = ({apiVersion, startTime, endTime}) => Promise.all([
	notificationsApi.createNotificationsList(startTime, {apiVersion})
		.then(groupNotifications),
	notificationsApi.createNotificationsList(endTime, {apiVersion})
		.then(groupNotifications),
])
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

const handleCanonicalChange = ({uuid, cachedCanonical, freshCanonical, fbRecord}) => database.get(cachedCanonical)
.then(databaseRecord => {
	const sentToFacebook = (fbRecord && fbRecord[mode] && !fbRecord[mode].nullRecord);
	const wasPublished = sentToFacebook && fbRecord[mode].published;

	const freshDatabaseRecord = Object.assign({}, databaseRecord, {
		canonical: freshCanonical,
	});

	// Purge the old canonical store
	return database.purgeCanonical(cachedCanonical)

		// update the canonical URL cache
		.then(() => database.setCanonical(uuid, freshCanonical))

		// Replace the database record with a fresh copy
		.then(() => Promise.all([
			database.delete(cachedCanonical),
			database.set(freshDatabaseRecord),
		]))

		// Remove any old Facebook IA
		.then(() => {
			if(!sentToFacebook) return Promise.resolve();
			return fbApi.delete({canonical: cachedCanonical});
		})

		// Fetch the article record fresh and republish to FB if required
		.then(() => articleModel.get(freshCanonical))
		.then(article => Promise.resolve()
			.then(() => {
				if(!sentToFacebook) {
					// Article wasn't yet published, so just tag the canonical change event
					return articleModel.setImportStatus({
						article,
						type: 'notifications-api-canonical-change',
					});
				}

				return transform(article)
					.then(({html, warnings}) =>
						fbApi.post({
							html,
							uuid: article.uuid,
							published: wasPublished,
						})
						.then(({id}) => articleModel.setImportStatus({
							article,
							id,
							warnings,
							type: 'notifications-api-canonical-change',
							published: wasPublished,
						}))
					);
			})
		);
});

// Article might have been deleted, so catch any ES errors
const refreshCanonical = uuid => ftApi.getCanonicalFromUuid(uuid)
.catch(() => null);

const checkUuid = uuid => articleModel.getCanonical(uuid)
.catch(() => null)
.then(cachedCanonical =>
	cachedCanonical && Promise.all([
		refreshCanonical(uuid),
		fbApi.find({canonical: cachedCanonical}),
	])
	.then(([freshCanonical, fbRecord]) => {
		const sentToFacebook = (fbRecord && fbRecord[mode] && !fbRecord[mode].nullRecord);

		return Promise.resolve()
		.then(() => {
			if(!freshCanonical) {
				// No canonical URL, so no further work to do.
				console.log(`${Date()}: NOTIFICATIONS API: Canonical URL for UUID ${uuid} is now null`);
				return;
			}

			if(cachedCanonical === freshCanonical) {
				// Canonical URL has not changed, so no further work to do.
				return;
			}

			console.log(`${Date()}: NOTIFICATIONS API: Canonical URL for UUID ${uuid} has changed from ${cachedCanonical} to ${freshCanonical}`);
			return handleCanonicalChange({
				uuid,
				cachedCanonical,
				freshCanonical,
				fbRecord,
			});
		})

		// If previously sent to Facebook, return this as a 'known UUID'.
		.then(() => (sentToFacebook ? uuid : null));
	})
);

const getKnownUuids = uuids => Promise.all(uuids.map(checkUuid))
.then(known => known.filter(uuid => !!uuid));

const updateArticles = uuids => Promise.all(
	uuids.map(uuid => articleModel.get(uuid)
		.then(staleArticle => articleModel.update(staleArticle))
		.then(article => {
			const sentToFacebook = (article.fbRecords[mode] && !article.fbRecords[mode].nullRecord);
			console.log(`${Date()}: NOTIFICATIONS API: processing known article [${article.uuid}], mode [${mode}], sentToFacebook [${sentToFacebook}]`);
			if(sentToFacebook) {
				return transform(article)
					.then(({html, warnings}) => fbApi.post({uuid: article.uuid, html, published: article.fbRecords[mode].published})
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
		.then(() => uuid)
	)
);

const deleteArticles = uuids => Promise.all(
	uuids.map(uuid => articleModel.getCanonical(uuid)
		.then(canonical => fbApi.delete({canonical})
			.then(() => database.get(canonical))
			.then(article => articleModel.setImportStatus({article, username: 'daemon', type: 'notifications-delete'}))
		)
		.then(() => uuid)
	)
);

const poller = () => database.getLastNotificationCheck()
.then(lastCheck => {
	lastCheck = lastCheck || (Date.now() - UPDATE_INTERVAL);

	const startTime = new Date(lastCheck - OVERLAP_INTERVAL - UPDATE_INTERVAL).toISOString();
	const endTime = new Date(lastCheck - OVERLAP_INTERVAL).toISOString();

	return Promise.all([
		fetch({apiVersion: 1, startTime, endTime}),
		fetch({apiVersion: 2, startTime, endTime}),
	]);
})
.then(merge)
.then(merged => Promise.all([
	getKnownUuids(merged.updates),
	getKnownUuids(merged.deletes),
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
	console.error(`${Date()}: NOTIFICATIONS API error: ${e.stack || e}`);
	if(mode === 'production') {
		ravenClient.captureException(e, {tags: {from: 'notifications'}});
	}
});

const loop = promiseLoopInterval(poller, UPDATE_INTERVAL);

module.exports = {
	init: loop,
};
