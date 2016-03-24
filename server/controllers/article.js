'use strict';

const articleModel = require('../models/article');
const testUuids = require('../lib/testUuids');

const checkParams = params => {
	const required = {
		get: ['uuid'],
		publish: ['uuid', 'feed'],
		unpublish: ['uuid', 'feed'],
	};
	const {action} = params;

	if(!required[action]) {
		throw Error(`Action [${action}] not recognised.`);
	}

	required[action].forEach(key => {
		if(!params[key]) {
			throw Error(`Missing required parameter [${key}] for action [${action}].`);
		}
	});

	return params;
};

const runAction = params => {
	const {uuid, feed, action} = checkParams(params);

	switch(action) {
		case 'get':
			return articleModel.get(uuid);

		case 'publish':
			return articleModel.publish(feed, uuid);

		case 'unpublish':
			return articleModel.unpublish(feed, uuid);

		default:
			throw Error(`Action [${action}] not recognised.`);
	}
};

module.exports = (req, res, next) => {
	const uuid = req.params.uuid;
	const feed = req.params.feed;
	const action = req.params.action;

	return Promise.resolve()
	.then(() => {
		if(!action) {
			return articleModel.get(uuid)
				.then(article => res.render('index', {uuid, article, testUuids}));
		}

		return runAction({uuid, feed, action})
			.then(() => articleModel.get(uuid))
			.then(response => res.send(response));
	})
	.catch(next);
};
