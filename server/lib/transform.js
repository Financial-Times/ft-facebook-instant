'use strict';

const xsltTransform = require('./xslt');
const cheerioTransform = require('./cheerio');
const handlebarsTransform = require('./handlebars').render;

const transformArticleBody = apiArticle => {
	const xsltParams = {
		// id: article.id,
		// webUrl: article.webUrl,
		// renderTOC: 0,
		// suggestedRead: 0,
		// brightcoveAccountId: process.env.BRIGHTCOVE_ACCOUNT_ID,

		// // See: https://github.com/ampproject/amphtml/blob/master/extensions
		// // /amp-brightcove/amp-brightcove.md#player-configuration
		// // NB: Next don't use the native Brightcove player, so don't use this param.
		// // Default seems fine.
		// // brightcovePlayerId: process.env.BRIGHTCOVE_PLAYER_ID
		// brightcovePlayerId: 'default',
	};

	return xsltTransform(
		apiArticle.bodyXML,
		`${process.cwd()}/server/stylesheets/main.xsl`,
		xsltParams
	)
	.then(cheerioTransform);
};

const getAnnotations = apiArticle => (apiArticle.annotations || [])
.map(annotation => annotation.prefLabel)
.join('; ');

const getTitle = apiArticle => apiArticle.title;

const getSubtitle = apiArticle =>
	Array.isArray(apiArticle.summaries) ? apiArticle.summaries[0] : null;

const getAuthors = apiArticle => {
	const authors = apiArticle.metadata
		.filter(item => !!(item.taxonomy && item.taxonomy === 'authors'))
		.map(item => item.prefLabel);

	// Somtimes there are no authors in the taxonomy. It's very sad but it's true.
	return authors.length ? authors : [(apiArticle.byline || '').replace(/^by\s+/i, '')];
};

module.exports = article => transformArticleBody(article.apiArticle)
.then(body => {
	const params = {
		body,
		canonicalUrl: article.canonical,
		style: 'default',
		date_published: article.date_editorially_published,
		date_updated: article.date_record_updated,
		tags: getAnnotations(article.apiArticle),
		title: getTitle(article.apiArticle),
		subtitle: getSubtitle(article.apiArticle),
		authors: getAuthors(article.apiArticle),
	};

	return handlebarsTransform(`${process.cwd()}/views/templates/article.html`, params);
});
