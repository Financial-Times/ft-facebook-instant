'use strict';
const getStreamUrl = require('./getStreamUrl');

module.exports = (article) => {
	const primaryTheme = (article.metadata || []).filter(item => !!item.primary)[0];
	if(!primaryTheme) return;

	return getStreamUrl(primaryTheme)
		.then(streamUrl => streamUrl && {
			url: streamUrl,
			label: primaryTheme.prefLabel,
		})
		.catch(() => {});
};
