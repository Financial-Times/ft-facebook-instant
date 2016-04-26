'use strict';

const xsltTransform = require('./xslt');
const cheerioTransforms = require('./transforms');
const handlebarsTransform = require('./handlebars').render;
const extractMainImage = require('./transforms/extractMainImage');
const getAnalyticsUrl = require('./analytics');
const validateArticleElements = require('./validator');
const getRelatedArticles = require('./related');

const requiredParams = [
	'apiRecord',
	'canonical',
	'uuid',
	'date_editorially_published',
	'date_record_updated',
];

const transformArticleBody = (apiRecord, warnings) => {
	if(!apiRecord.bodyHTML) {
		return Promise.reject(Error('Missing required [bodyHTML] field'));
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
	.then(body => cheerioTransforms(body, warnings));
};

const getAnnotations = apiRecord => (apiRecord.annotations || [])
.map(annotation => annotation.prefLabel)
.join('; ');

const getTitle = apiRecord => apiRecord.title;

const getSubtitle = apiRecord =>
	(Array.isArray(apiRecord.summaries) ? apiRecord.summaries[0] : null);

const getAuthors = apiRecord => {
	const authors = apiRecord.metadata
		.filter(item => !!(item.taxonomy && item.taxonomy === 'authors'))
		.map(item => item.prefLabel);

	// Somtimes there are no authors in the taxonomy. It's very sad but it's true.
	return authors.length ? authors : [(apiRecord.byline || '').replace(/^by\s+/i, '')];
};

const basicValidate = article => Promise.resolve()
.then(() => {
	const missing = requiredParams.filter(key => !article[key]);
	if(missing.length) {
		throw Error(`Article [${article.canonical}] is missing required keys: [${missing.join(', ')}]`);
	}
});

module.exports = article => {
	const warnings = [];

	return basicValidate(article)
	.then(() => Promise.all([
		transformArticleBody(article.apiRecord, warnings),
		getRelatedArticles(article.apiRecord),
	]))
	.then(([transformed$, relatedArticles]) => {
		validateArticleElements(transformed$, warnings);

		const mainImageHtml = extractMainImage(transformed$, warnings);
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
			tags: getAnnotations(article.apiRecord, warnings),
			title: getTitle(article.apiRecord, warnings),
			subtitle: getSubtitle(article.apiRecord, warnings),
			authors: getAuthors(article.apiRecord, warnings),
			cookieChecker: false,
			relatedArticles,
		};

		return handlebarsTransform(`${process.cwd()}/views/templates/article.html`, params)
			.then(html => ({html, warnings}));
	});
};
