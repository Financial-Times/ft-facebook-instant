'use strict';

const notificationsApi = require('../lib/notifications');
const database = require('../lib/database');
const articleModel = require('../models/article');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');
const ravenClient = require('../lib/raven').client;
const RichError = require('../lib/richError');
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
				throw new RichError('Unrecognised notification type', {extra: {notificationType: item.type}});
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

const existsOnFacebook = article => !!(article.fbRecords && article.fbRecords[mode] && !article.fbRecords[mode].nullRecord);

const moveCanonical = ({uuid, cachedCanonical, freshCanonical}) =>
	// Purge the old canonical store
	database.purgeCanonical(cachedCanonical)
		// update the canonical URL cache
		.then(() => database.setCanonical(uuid, freshCanonical));

const handleCanonicalChange = ({uuid, cachedCanonical, freshCanonical, fbRecords}) => database.get(cachedCanonical)
.then(databaseRecord => {
	const sentToFacebook = existsOnFacebook({fbRecords});
	const wasPublished = sentToFacebook && fbRecords[mode].published;

	console.log(`${Date()}: NOTIFICATIONS API: handleCanonicalChange for UUID ${uuid} ` +
		` from ${cachedCanonical} to ${freshCanonical}. Exists on Facebook: ${!!sentToFacebook}, ` +
			`wasPublished: ${wasPublished}, hasDatabaseRecord: ${!!databaseRecord}.`);

	const movePromise = moveCanonical({uuid, freshCanonical, cachedCanonical});

	if(!databaseRecord) {
		// Some articles have canonical records but no article record in the database (if
		// they've only been seen previously as related content, for example). In this case,
		// there's nothing more to do
		return movePromise.then(() => {});
	}

	return movePromise

		// Replace the database record with a fresh copy
		.then(() => Promise.all([
			database.delete(cachedCanonical),
			database.set(Object.assign({}, databaseRecord, {
				canonical: freshCanonical,
			})),
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
						articleModel.postAndSetStatus({
							article,
							published: wasPublished,
							wait: true,
							warnings,
							type: 'notifications-api-canonical-change',
						})
					);
			})
		);
});

// Article might have been deleted, so catch any ES errors
const refreshCanonical = uuid => ftApi.getCanonicalFromUuid(uuid)
.catch(() => null);

const getKnownCanonical = uuid => database.getCanonical(uuid)
.catch(() => null);

// For each UUID, get any cached canonical URL
const getKnownArticles = uuids => Promise.all(uuids.map(
	uuid => getKnownCanonical(uuid)
		.then(cachedCanonical => ({uuid, cachedCanonical}))
))
// Then update to ensure the canonical URL is fresh
.then(articles =>
	Promise.all(articles.map(
		article => refreshCanonical(article.uuid)
			.then(freshCanonical => Object.assign(article, {freshCanonical}))
	))
)
// Only articles with a fresh, current canonical URL are of interest
.then(articles => articles.filter(article => article.freshCanonical))
// Then search Facebook for any records matching either stale or fresh canonical
.then(articles =>
	fbApi.findMany({
		type: 'article',
		ids: articles.map(article => article.cachedCanonical || article.freshCanonical),
	})
	.then(fbRecordsList => articles.map(
		article => {
			const fbRecords = fbRecordsList[article.cachedCanonical || article.freshCanonical];
			return Object.assign(article, {fbRecords});
		}
	))
)
// Adjust articles which exist on FB but which don't have a locally cached canonical URL
.then(articles => articles.map(article => {
	if(!article.cachedCanonical && existsOnFacebook(article)) {
		article.cachedCanonical = article.fbRecords[mode].canonical_url;
	}
	return article;
}))
// Only articles with either a cached canonical URL or a Facebook record are of interest
.then(articles => articles.filter(article => article.cachedCanonical))
.then(articles => Promise.all(
	articles.map(
		article => {
			if(article.cachedCanonical !== article.freshCanonical) {
				return handleCanonicalChange(article);
			}

			return articleModel.get(article.freshCanonical);
		}
	)
))
// Only articles which have been sent to Facebook need updating on Facebook.
.then(articles => articles.filter(article => existsOnFacebook(article)));

const updateArticle = stale => articleModel.update(stale)
.then(article => {
	const published = article.fbRecords[mode].published;
	console.log(`${Date()}: NOTIFICATIONS API: updating known article: [${article.uuid}], mode: [${mode}], ` +
		`was published: [${published}]`);
	return transform(article)
					.then(({html, warnings}) =>
	articleModel.postAndSetStatus({
		article,
		html,
		warnings,
		published,
		wait: true,
		username: 'daemon',
		type: 'notifications-api',
	})
);
});

const updateArticles = articles => Promise.all(articles.map(updateArticle))
.then(updated => updated.map(article => article.uuid));

const deleteArticle = ({uuid, canonical, fbRecords}) => fbApi.delete({canonical})
.then(() => database.get(canonical))
.then(article => article && articleModel.setImportStatus({article, username: 'daemon', type: 'notifications-delete'}));

const deleteArticles = articles => Promise.all(articles.map(deleteArticle))
.then(deleted => deleted.map(article => article.uuid));

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
.then(merged => {
	if(merged.updates.length) {
		console.log(`${Date()}: NOTIFICATIONS API: processing ${merged.updates.length} updates:` +
		` ${merged.updates.join(', ')}.`);
	}
	if(merged.deletes.length) {
		console.log(`${Date()}: NOTIFICATIONS API: processing ${merged.deletes.length} deletes:` +
		` ${merged.deletes.join(', ')}.`);
	}
	return Promise.all([
		getKnownArticles(merged.updates),
		getKnownArticles(merged.deletes),
	]);
})
.then(([updates, deletes]) => {
	if(updates.length) console.log(`${Date()}: NOTIFICATIONS API: will update known articles: ${updates.map(article => article.uuid).join(', ')}.`);
	if(deletes.length) console.log(`${Date()}: NOTIFICATIONS API: will delete known articles: ${deletes.map(article => article.uuid).join(', ')}.`);
	return [updates, deletes];
})
.then(([updates, deletes]) => Promise.all([
	updateArticles(updates),
	deleteArticles(deletes),
]))
.then(([updated, deleted]) => {
	if(updated.length) {
		console.log(`${Date()}: NOTIFICATIONS API: updated articles ${updated.join(', ')}`);
	} else {
		console.log(`${Date()}: NOTIFICATIONS API: no articles were updated`);
	}

	if(deleted.length) {
		console.log(`${Date()}: NOTIFICATIONS API: deleted articles ${deleted.join(', ')}`);
	} else {
		console.log(`${Date()}: NOTIFICATIONS API: no articles were deleted`);
	}

	return database.setLastNotificationCheck(Date.now());
})
.catch(e => {
	console.error(`${Date()}: NOTIFICATIONS API error: ${e.stack || e}`);
	ravenClient.captureRichException(e, {tags: {from: 'notifications'}});
});

const loop = promiseLoopInterval(poller, UPDATE_INTERVAL);

module.exports = {
	init: loop,
};
