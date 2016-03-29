'use strict';

const RSS = require('rss');
const moment = require('moment');
const types = ['development', 'production'];

const generate = (type, articles) => {
	const articleModel = require('./article');
	const feed = new RSS({
		title: 'Facebook Instant Articles feed for FT.com',
		description: `Facebook Instant Articles feed for FT.com (${type})`,
		site_url: 'https://facebookinstant.ft.com/feed',
		generator: 'https://github.com/Financial-Times/ft-facebook-instant',
	});

	const promises = articles.map(article => articleModel.transform(article)
		.then(transformed => {
			const elements = [
				{description: transformed.subtitle},
				{link: `http://www.ft.com/content/${article.uuid}`},
				{pubDate: moment(transformed.date_published).format()},
			];

			transformed.authors.forEach(author => {
				elements.push({author});
			});

			elements.push({
				'content:encoded': transformed.html,
			});

			feed.item({
				title: transformed.title,
				guid: transformed.uuid,
				custom_elements: elements,
			});
		})
	);

	return Promise.all(promises)
		.then(() => feed.xml({indent: '\t'}));
};


module.exports = {
	types,
	generate,
};
