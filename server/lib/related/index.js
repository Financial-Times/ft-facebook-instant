'use strict';

const articlesToLinks = require('./articlesToLinks');
const fns = [
	require('./getStoryPackage'),
	require('./getMoreOns'),
];

const getRelatedArticles = async article => {
	const articles = new Set();
	for(const fn of fns) {
		const uuids = (await fn(article))
			.filter(uuid => uuid !== article.id);

		(await articlesToLinks(uuids))
			.forEach(moreArticle => articles.add(moreArticle));

		if(articles.size >= 3) break;
	}

	return Array.from(articles).slice(0, 3);
};

module.exports = getRelatedArticles;
