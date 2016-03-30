'use strict';

const testUuids = require('../lib/testUuids');
const database = require('../lib/database');
const fbApi = require('../lib/fbApi');

const getList = (articles, mode) => {
	if(mode) {
		return articles.filter(article => (
			article[`date_published_${mode}`] ||
			article[`date_imported_${mode}`]
		))
		.sort((a, b) => (
				(b[`date_imported_${mode}`] - a[`date_imported_${mode}`]) ||
				(b[`date_published_${mode}`] - a[`date_published_${mode}`])
			)
		)
		.map(article => ({
			uuid: article.uuid,
			title: article.title,
			date_editorially_published: article.date_editorially_published,
			date_record_updated: article.date_record_updated,
			date_published: article[`date_published_${mode}`],
			date_imported: article[`date_imported_${mode}`],
		}));
	} else {
		return articles.filter(article => (
			!article.date_published_development &&
			!article.date_imported_development &&
			!article.date_published_production &&
			!article.date_imported_production
		))
		.map(article => ({
			uuid: article.uuid,
			title: article.title,
			date_editorially_published: article.date_editorially_published,
			date_record_updated: article.date_record_updated,
		}));
	}
};

module.exports = (req, res, next) => Promise.all([
	database.list(),
	fbApi.list({mode: 'development'}),
	fbApi.list({mode: 'production'}),
])
.then(([db, development, production]) => {
	// res.json({db, development, production});
	return db;
})
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
