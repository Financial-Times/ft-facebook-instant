'use strict';

const database = require('../lib/database');
const articleModel = require('../models/article');
const testUuids = require('../lib/testUuids');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');

const runAction = ({url, action}, res) => {
	switch(action) {
		case 'get':
			return articleModel.get(url)
				.then(article => res.json(article));

		case 'db':
			return database.get(url)
				.then(article => res.json(article));

		case 'fb':
			return database.get(url)
				.then(article => fbApi.find({canonical: article.canonical}))
				.then(result => res.json(result));

		case 'transform':
			return articleModel.get(url)
				.then(transform)
				.then(transformed => res.send(transformed));

		case 'update':
			return articleModel.get(url)
				.then(articleModel.update)
				.then(html => res.send(html));

		case 'import':
			return articleModel.get(url)
				.then(article => transform(article)
					.then(html => fbApi.post({html}))
					.then(({id}) => articleModel.setImportStatus({article, id, type: 'ui'}))
				)
				.then(article => res.json(article));

		case 'publish':
			return articleModel.get(url)
				.then(article => transform(article)
					.then(html => fbApi.post({html, published: true}))
					.then(({id}) => articleModel.setImportStatus({article, id, type: 'ui'}))
				)
				.then(article => res.json(article));

		case 'reingest':
			return ftApi.updateEs(url)
				.then(() => articleModel.get(url))
				.then(articleModel.update)
				.then(html => res.send(html));

		case 'delete':
			return fbApi.delete({canonical: url})
				.then(() => articleModel.get(url))
				.then(article => res.json(article));

		default:
			throw Error(`Action [${action}] not recognised.`);
	}
};

module.exports = (req, res, next) => {
	const url = req.params.url;
	const action = req.params.action;

	if(!url) {
		throw Error(`Missing required parameter [url] for action [${action}].`);
	}

	return Promise.resolve()
	.then(() => {
		if(!action) {
			return articleModel.get(url)
				.then(article => res.render('index', {article, testUuids}));
		}

		return runAction({url, action}, res);
	})
	.catch(next);
};
