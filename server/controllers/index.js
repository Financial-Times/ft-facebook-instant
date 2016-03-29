'use strict';

const testUuids = require('../lib/testUuids');
const database = require('../lib/database');

const getList = (articles, feed) => {
	if(feed) {
		return articles.filter(article => (
			article[`date_published_${feed}`] ||
			article[`date_imported_${feed}`] ||
			article[`${feed}_impressions.length`]
		))
		.sort((a, b) => (
				(b[`date_imported_${feed}`] - a[`date_imported_${feed}`]) ||
				(b[`date_published_${feed}`] - a[`date_published_${feed}`])
			)
		)
		.map(article => ({
			uuid: article.uuid,
			title: article.title,
			date_editorially_published: article.date_editorially_published,
			date_record_updated: article.date_record_updated,
			date_published: article[`date_published_${feed}`],
			date_imported: article[`date_imported_${feed}`],
			impressions: article[`${feed}_impressions`],
		}));
	} else {
		return articles.filter(article => (
			!article.date_published_development &&
			!article.date_imported_development &&
			!article.development_impressions.length &&
			!article.date_published_production &&
			!article.date_imported_production &&
			!article.production_impressions.length
		))
		.map(article => ({
			uuid: article.uuid,
			title: article.title,
			date_editorially_published: article.date_editorially_published,
			date_record_updated: article.date_record_updated,
		}));
	}
};

module.exports = (req, res, next) => database.list()
.then(articlesObj => {
	const articles = Object.keys(articlesObj).map(uuid => articlesObj[uuid]);
	const development = getList(articles, 'development');
	const production = getList(articles, 'production');
	const other = getList(articles);

	return {
		development,
		production,
		other,
	};
})
.then(articles => res.render('index', {
	articles,
	testUuids,
}))
.catch(next);
