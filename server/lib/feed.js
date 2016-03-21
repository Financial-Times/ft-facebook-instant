'use strict';

const RSS = require('rss');
const moment = require('moment');

const forceUpdates = false;

module.exports.generate = type => {
	const feed = new RSS({
		title: 'Facebook Instant Articles feed for FT.com',
		description: `Facebook Instant Articles feed for FT.com (${type})`,
		site_url: 'https://facebookinstant.ft.com/feed',
		generator: 'https://github.com/Financial-Times/ft-facebook-instant',
	});

	const fixturePath = require('path').resolve(__dirname, '../../test/fixtures/94e97eee-ce9a-11e5-831d-09f7778e7377.html');
	let article = require('fs').readFileSync(fixturePath, 'utf8');

	if(forceUpdates) {
		const now = moment();
		const isoTimestamp = now.format();
		const humanTime = now.format('MMMM Do, YYYY');

		article = article.replace(
			'<time class="op-modified" datetime="2016-02-12T10:34:09Z">February 12, 2016</time>',
			`<time class="op-modified" datetime="${isoTimestamp}">${humanTime}</time>`
		);
	}

	feed.item({
		// The headline of the article.
		title: 'Why millennials go on holiday instead of saving for a pension',

		// A string that provides a unique identifier for this article in your feed.
		guid: '94e97eee-ce9a-11e5-831d-09f7778e7377',

		custom_elements: [
			// A summary of your article, in plain text form.
			{description: '20-somethings feel financially doomed so do not save'},

			// 	Name of the person who wrote the article. Use multiple <author> elements for
			// 	multiple authors.
			{author: 'Aime Williams'},

			// The canonical URL for this article on your site.
			{link: 'http://www.ft.com/content/94e97eee-ce9a-11e5-831d-09f7778e7377'},

			// The date of the article’s publication, in ISO-8601 format.
			{pubDate: '2016-02-12T10:34:09Z'},

			// The full content of your article, in HTML form. Remember to escape all HTML
			// content by wrapping it within a CDATA section.
			{'content:encoded': article},
		],
	});

	const rss = feed.xml({indent: '\t'});
	return Promise.resolve(rss);
};
