'use strict';

const api = require('next-ft-api-client');
const articlesToLinks = require('./articlesToLinks');
const moreOnCount = 3;

const getStreamArticles = metadatum => api.search({
	filter: ['metadata.idV1', metadatum.idV1],

	// Fetch twice as many as we need, to allow for deduping
	count: moreOnCount * 2,
	fields: [
		'id',
		'title',
	],
}).then(res => res.filter(article => article.title));


const getMoreOns = async (article) => {
	const moreOns = article.metadata.filter(({primary}) => primary);
	let allLinks = [];
	const streams = await Promise.all(moreOns.map(getStreamArticles));
	for(const articles of streams) {
		allLinks = allLinks.concat(await articlesToLinks(articles));
	}
	return allLinks;
};

module.exports = getMoreOns;
