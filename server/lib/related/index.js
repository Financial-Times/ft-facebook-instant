'use strict';

const fns = [
	require('./getStoryPackage'),
	require('./getMoreOns'),
];

const getRelatedArticles = async article => {
	const articles = new Set();
	for(const fn of fns) {
		(await fn(article)).forEach(moreArticle => articles.add(moreArticle));

		if(articles.size >= 3) break;
	}

	return Array.from(articles).slice(0, 3);
};

module.exports = getRelatedArticles;
