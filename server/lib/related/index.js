'use strict';

const checkLink = require('./checkLink');

module.exports = function getRelatedArticles(article) {
	return Promise.all(
		article.storyPackage
		.map(({id}) => checkLink(`http://www.ft.com/content/${id}`))
	)
	.then(validatedLinks => validatedLinks.filter(validatedLink => validatedLink).slice(0, 3));
};
