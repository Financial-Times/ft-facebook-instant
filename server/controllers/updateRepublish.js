'use strict';

const articleModel = require('../models/article');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');
const ravenClient = require('../lib/raven');

const mode = require('../lib/mode').get();

const update = (article, {onlyAfterRedeploy = true} = {}) => {
	const publishedByOldVersion = article.import_meta[0] && article.import_meta[0].appVersion !== process.env.HEROKU_RELEASE_VERSION;
	const shouldRepublish = !onlyAfterRedeploy || publishedByOldVersion;
	const sentToFacebook = (article.fbRecords[mode] && !article.fbRecords[mode].nullRecord);
	if(sentToFacebook && shouldRepublish) {
		return transform(article)
			.then(({html, warnings}) => fbApi.post({uuid: article.uuid, html, published: article.fbRecords[mode].published})
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
};

const republish = options => fbApi.list({fields: ['canonical_url']})
.then(articles => articles.map(article => article.canonical_url))
.then(canonicals => articleModel.getList(canonicals))
.then(articles => Promise.all(articles.map(article => update(article, options))))
.then(articles => articles.filter(article => !!article));

module.exports = (options) => republish(options)
	.then(updatedArticles => {
		if(updatedArticles.length) {
			console.log(`${Date()}: UPDATE/REPUBLISH: updated articles ${updatedArticles.map(({uuid}) => uuid)}`);
		} else {
			console.log(`${Date()}: UPDATE/REPUBLISH: no articles to update`);
		}
	}).catch(e => {
		console.error(e.stack || e);
		if(mode === 'production') {
			ravenClient.captureException(e, {tags: {from: 'republish'}});
		}
	});

module.exports.route = (req, res, next) => republish({onlyAfterRedeploy: false}).then(updatedArticles => {
	res.status(200).json(updatedArticles.map(({uuid}) => uuid));
}).catch(next);
