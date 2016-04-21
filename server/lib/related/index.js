'use strict';

const fns = [
	require('./getStoryPackage'),
];

module.exports = async article => {
	const articles = new Set();
	for(let fn of fns) {
		(await fn(article)).forEach(moreArticle => articles.add(moreArticle));

		if(articles.size >= 3) break;
	}

	return Array.from(articles).slice(0, 3);
};
