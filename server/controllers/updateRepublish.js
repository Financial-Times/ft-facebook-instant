'use strict';

const articleModel = require('../models/article');
const transform = require('../lib/transform');
const fbApi = require('../lib/fbApi');

const mode = require('../lib/mode').get();

const republish = ({onlyAfterRedeploy = true} = {}) => fbApi.list()
			.then(
				articles => Promise.all(
					articles.map(
						({canonical_url}) => articleModel.get(canonical_url)
							.then(article => {
								const publishedByOldVersion = article.import_meta[0] && article.import_meta[0].appVersion !== process.env.HEROKU_RELEASE_VERSION;
								const shouldRepublish = !onlyAfterRedeploy || publishedByOldVersion;
								const sentToFacebook = article.fbRecords[mode];
								if(sentToFacebook && shouldRepublish) {
									return transform(article)
										.then(({html, warnings}) => fbApi.post({html, published: article.fbRecords[mode].published})
											.then(({id}) => articleModel.setImportStatus({article, id, warnings, type: 'update-redeploy'}))
										);
								}
							})
					)
				)
					.then(updatedArticles => updatedArticles.filter(a => !!a)));

module.exports = (options) => republish(options)
	.then(updatedArticles => {
		if(updatedArticles.length) {
			console.log(`${Date()}: updated articles ${updatedArticles.map(({uuid}) => uuid)}`);
		} else {
			console.log(`${Date()}: no articles to update`);
		}
	}).catch(e => console.log(e.stack)); // TODO: error reporting

module.exports.route = (req, res, next) => republish({onlyAfterRedeploy: false}).then(updatedArticles => {
	res.status(200).json(updatedArticles.map(({uuid}) => uuid));
}).catch(next);
