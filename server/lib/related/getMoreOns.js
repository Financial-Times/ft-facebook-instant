'use strict';

const api = require('next-ft-api-client');
const moreOnCount = 3;

const getStreamArticles = metadatum => api.search({
	filter: ['metadata.idV1', metadatum.idV1],

	// Fetch twice as many as we need, to allow for deduping
	count: moreOnCount * 2,
	fields: [
		'id',
		'title',
	],
}).then(res => res.filter(article => article.title).map(article => article.id));


const getMoreOns = async (article) => {
	const moreOns = article.metadata.filter(({primary}) => primary);
	let all = [];
	const streams = await Promise.all(moreOns.map(getStreamArticles));
	for(const articles of streams) {
		all = all.concat(await articles);
	}
	return all;
};

module.exports = getMoreOns;
