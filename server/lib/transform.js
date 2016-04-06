'use strict';

const xsltTransform = require('./xslt');
const cheerioTransforms = require('./transforms');
const handlebarsTransform = require('./handlebars').render;
const extractMainImage = require('./transforms/extractMainImage');
const getAnalyticsUrl = require('./analytics');
const validateArticleElements = require('./validator');

const transformArticleBody = apiRecord => {
	if(!apiRecord.bodyHTML) {
		throw Error('Missing required [bodyHTML] field');
	}

	const xsltParams = {
		brightcoveAccountId: process.env.BRIGHTCOVE_ACCOUNT_ID,
		brightcovePlayerId: 'default',
	};

	return xsltTransform(
		apiRecord.bodyHTML,
		`${process.cwd()}/server/stylesheets/main.xsl`,
		xsltParams
	)
	.then(cheerioTransforms);
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
	validateArticleElements(transformed$);

	const mainImageHtml = extractMainImage(transformed$);
	const analyticsUrl = getAnalyticsUrl(article);
	const body = transformed$.html();
	const params = {
		body,
		mainImageHtml,
		analyticsUrl,
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
