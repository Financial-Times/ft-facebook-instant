'use strict';

const xsltTransform = require('./xslt');
const cheerioTransform = require('./cheerio');
const handlebarsTransform = require('./handlebars').render;
const extractMainImage = require('./transforms/extractMainImage');

const transformArticleBody = apiRecord => {
	if(!apiRecord.bodyHTML) {
		throw Error('Missing required [bodyHTML] field');
	}

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
		apiRecord.bodyHTML,
		`${process.cwd()}/server/stylesheets/main.xsl`,
		xsltParams
	)
	.then(cheerioTransform);
};

const getAnnotations = apiRecord => (apiRecord.annotations || [])
.map(annotation => annotation.prefLabel)
.join('; ');

const getTitle = apiRecord => apiRecord.title;

const getSubtitle = apiRecord =>
	Array.isArray(apiRecord.summaries) ? apiRecord.summaries[0] : null;

const getAuthors = apiRecord => {
	const authors = apiRecord.metadata
		.filter(item => !!(item.taxonomy && item.taxonomy === 'authors'))
		.map(item => item.prefLabel);

	// Somtimes there are no authors in the taxonomy. It's very sad but it's true.
	return authors.length ? authors : [(apiRecord.byline || '').replace(/^by\s+/i, '')];
};

module.exports = article => transformArticleBody(article.apiRecord)
.then(transformed$ => {
	const mainImageHtml = extractMainImage(transformed$);
	const body = transformed$.html();
	const params = {
		body,
		mainImageHtml,
		canonicalUrl: article.canonical,
		style: 'default',
		date_published: article.date_editorially_published,
		date_updated: article.date_record_updated,
		tags: getAnnotations(article.apiRecord),
		title: getTitle(article.apiRecord),
		subtitle: getSubtitle(article.apiRecord),
		authors: getAuthors(article.apiRecord),
	};

	return handlebarsTransform(`${process.cwd()}/views/templates/article.html`, params);
});
