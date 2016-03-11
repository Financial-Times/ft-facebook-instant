'use strict';

const RSS = require('rss');

module.exports.generate = () => {
	const feed = new RSS({
		title: 'Facebook Instant Articles feed for FT.com',
		description: 'Facebook Instant Articles feed for FT.com',
		site_url: 'https://facebookinstant.ft.com/feed',
		generator: 'https://github.com/Financial-Times/ft-facebook-instant',
	});

	const fixturePath = require('path').resolve(__dirname, '../../test/fixtures/facebook-test-article.html');
	const article = require('fs').readFileSync(fixturePath, 'utf8');

	// See: https://developers.facebook.com/docs/instant-articles/publishing
	feed.item({
		// The headline of the article.
		title: 'The headline of the article.',

		// A string that provides a unique identifier for this article in your feed.
		guid: 'A string that provides a unique identifier for this article in your feed.',

		custom_elements: [
			// A summary of your article, in plain text form.
			{description: 'A summary of your article, in plain text form.'},

			// 	Name of the person who wrote the article. Use multiple <author> elements for
			// 	multiple authors.
			{author: 'George Crawford'},

			// The canonical URL for this article on your site.
			{link: 'The canonical URL for this article on your site.'},

			// The date of the article’s publication, in ISO-8601 format.
			{pubDate: 'The date of the article’s publication, in ISO-8601 format.'},

			// The full content of your article, in HTML form. Remember to escape all HTML
			// content by wrapping it within a CDATA section.
			{'content:encoded': article},
		],
	});

	return feed.xml({indent: '\t'});
};
