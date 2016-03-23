'use strict';

const RSS = require('rss');
const moment = require('moment');
const types = ['development', 'production'];


const generate = (type, articles) => {
	const feed = new RSS({
		title: 'Facebook Instant Articles feed for FT.com',
		description: `Facebook Instant Articles feed for FT.com (${type})`,
		site_url: 'https://facebookinstant.ft.com/feed',
		generator: 'https://github.com/Financial-Times/ft-facebook-instant',
	});

	articles.forEach(article => {
		const published = moment(parseInt(article.date_editorially_published, 10));
		console.log('PUBLISHED:', article.date_editorially_published, parseInt(article.date_editorially_published, 10), published.format());

		feed.item({
			// The headline of the article.
			title: article.apiArticle.title,

			// A string that provides a unique identifier for this article in your feed.
			guid: article.uuid,

			custom_elements: [
				// A summary of your article, in plain text form.
				{description: Array.isArray(article.apiArticle.summaries) ? article.apiArticle.summaries[0] : ''},

				// 	Name of the person who wrote the article. Use multiple <author> elements for
				// 	multiple authors.
				{author: article.apiArticle.byline},

				// The canonical URL for this article on your site.
				{link: `http://www.ft.com/content/${article.uuid}`},

				// The date of the article’s publication, in ISO-8601 format.
				{pubDate: published.format()},

				// The full content of your article, in HTML form. Remember to escape all HTML
				// content by wrapping it within a CDATA section.
				{'content:encoded': article.apiArticle.bodyXML},
			],
		});
	});

	const rss = feed.xml({indent: '\t'});
	return Promise.resolve(rss);
};


module.exports = {
	types,
	generate,
};
