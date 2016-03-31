'use strict';

const database = require('../lib/database');
const articleModel = require('../models/article');
const testUuids = require('../lib/testUuids');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');

const checkParams = params => {
	const required = {
		get: ['uuid'],
		db: ['uuid'],
		fb: ['uuid'],
		transform: ['uuid'],
		update: ['uuid'],
		publish: ['uuid', 'mode'],
		unpublish: ['uuid', 'mode'],
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

const runAction = (params, res) => {
	const {uuid, mode, action} = checkParams(params);

	switch(action) {
		case 'get':
			return articleModel.get(uuid)
				.then(article => res.json(article));

		case 'db':
			return database.get(uuid)
				.then(article => res.json(article));

		case 'fb':
			return database.get(uuid)
				.then(article => fbApi.find({canonical: article.canonical}))
				.then(result => res.json(result));

		case 'transform':
			return articleModel.get(uuid)
				.then(transform)
				.then(transformed => res.send(transformed));

		case 'update':
			return articleModel.get(uuid)
				.then(articleModel.update)
				.then(html => res.send(html));

		case 'publish':
			return articleModel.get(uuid)
				.then(article => transform(article)
					.then(html => fbApi.post({mode, html}))
					.then(({id}) => articleModel.setImportStatus(article, id))
				)
				.then(article => res.json(article));

		case 'unpublish':
			return articleModel[action](mode, uuid)
				.then(() => articleModel.get(uuid))
				.then(article => res.json(article));

		default:
			throw Error(`Action [${action}] not recognised.`);
	}
};

module.exports = (req, res, next) => {
	const uuid = req.params.uuid;
	const mode = req.params.mode;
	const action = req.params.action;

	return Promise.resolve()
	.then(() => {
		if(!action) {
			return articleModel.get(uuid)
				.then(article => res.render('index', {uuid, article, testUuids}));
		}

		return runAction({uuid, mode, action}, res);
	})
	.catch(next);
};
