'use strict';

// See: https://github.com/Financial-Times/next-es-interface/blob/master/server/getNotifications.js

const request = require('request');
const notificationsUrl = 'http://api.ft.com/content/notifications/v1/items';
const v2NotificationsUrl = 'http://api.ft.com/content/notifications/';
const apiKey = process.env.API_V1_KEY;

// Extract the URL needed to get the next set of notifications
const getNextNotificationsUrl = notifications => {
	if(notifications.notifications.length > 0) {
		return notifications.links[0].href;
	} else {
		return false;
	}
};

// We normalise to V1 format
// If there are no notifications or they are v1 just return
const normaliseNotifications = notifications => {
	if(notifications.length === 0 || notifications[0].data) {
		return notifications;
	} else {
		return notifications.map(item => {
			const newNotification = {
				data: {},
			};

			if(item.type.indexOf('UPDATE') > -1) {
				newNotification.type = 'content-item-update';
			} else {
				newNotification.type = 'content-item-deletion';
			}

			newNotification.data['content-item'] = {
				id: item.id.replace('http://www.ft.com/thing/', ''),
				apiUrl: item.apiUrl,
			};

			return newNotification;
		});
	}
};

// recursively fetch new notifications
const getNotifications = (url, notifications, cb) => {
	request(url, (error, response, body) => {
		if(!error && response.statusCode === 200) {
			try {
				const data = JSON.parse(body);

				// Normalise the notification format
				const newNotifications = normaliseNotifications(data.notifications);

				// Append any new notifications
				notifications = notifications.concat(newNotifications);

				// Figure out if there are any more links to come
				const nextLink = getNextNotificationsUrl(data);

				if(nextLink !== false) {
					getNotifications(`${nextLink}&apiKey=${apiKey}&feature.blogposts=on`, notifications, cb);
					return;
				}
				cb(null, notifications);
			} catch(e) {
				cb(e);
				return;
			}
		} else {
			cb(error);
			return;
		}
	});
};

function getNotificationsUrl(options) {
	if(options && options.apiVersion && options.apiVersion === 1) {
		return notificationsUrl;
	} else {
		return v2NotificationsUrl;
	}
}

// Fetch a list of all notifications from a given date
const createNotificationsList = (since, options) => new Promise((resolve, reject) => {
	const url = `${getNotificationsUrl(options)}?apiKey=${apiKey}&feature.blogposts=on&since=${since}`;
	getNotifications(url, [], (err, notifications) => {
		if(err) {
			reject(err);
		} else {
			resolve(notifications);
		}
	});
});

module.exports.createNotificationsList = createNotificationsList;
