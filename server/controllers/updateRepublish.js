'use strict';

const articleModel = require('../models/article');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');
const ravenClient = require('../lib/raven').client;
const {version} = require('../../package.json');

const mode = require('../lib/mode').get();

const update = (article, {onlyAfterRedeploy = true} = {}) => {
	const isDevelopment = version === '0.0.0-development';
	const publishedByOldVersion = !isDevelopment && article.import_meta[0] && article.import_meta[0].appVersion !== version;
	const shouldRepublish = !onlyAfterRedeploy || publishedByOldVersion;
	const sentToFacebook = (article.fbRecords[mode] && !article.fbRecords[mode].nullRecord);
	if(sentToFacebook && shouldRepublish) {
		return transform(article)
			.then(({html, warnings}) =>
				fbApi.post({
					uuid: article.uuid,
					html,
					published: article.fbRecords[mode].published,
					wait: true,
				})
				.then(({id}) => articleModel.setImportStatus({
					article,
					id,
					warnings,
					published: article.fbRecords[mode].published,
					username: 'daemon',
					type: 'update-redeploy',
				}))
			);
	}

	return Promise.resolve(null);
};

const handleError = e => {
	console.error(`${Date()}: UPDATE/REPUBLISH error: ${e.stack || e}`);
	ravenClient.captureException(e, {tags: {from: 'republish'}});
};

const republish = options => fbApi.list({fields: ['canonical_url'], __limit: 0})
.then(articles => articles.map(article => article.canonical_url))
.then(canonicals => articleModel.getList(canonicals))
.then(articles => Promise.all(
	articles.map(
		article => update(article, options).catch(handleError)
	)
))
.then(articles => articles.filter(article => !!article));

module.exports = (options) => republish(options)
	.then(updatedArticles => {
		if(updatedArticles.length) {
			console.log(`${Date()}: UPDATE/REPUBLISH: updated articles ${updatedArticles.map(({uuid}) => uuid)}`);
		} else {
			console.log(`${Date()}: UPDATE/REPUBLISH: no articles to update`);
		}
	}).catch(handleError);

module.exports.route = (req, res, next) => republish({onlyAfterRedeploy: false}).then(updatedArticles => {
	res.status(200).json(updatedArticles.map(({uuid}) => uuid));
}).catch(next);
