'use strict';

const xsltTransform = require('./xslt');

function transformArticleBody(article) {
	const xsltParams = {
		id: article.id,
		webUrl: article.webUrl,
		renderTOC: 0,
		suggestedRead: 0,
		brightcoveAccountId: process.env.BRIGHTCOVE_ACCOUNT_ID,

		// See: https://github.com/ampproject/amphtml/blob/master/extensions
		// /amp-brightcove/amp-brightcove.md#player-configuration
		// NB: Next don't use the native Brightcove player, so don't use this param.
		// Default seems fine.
		// brightcovePlayerId: process.env.BRIGHTCOVE_PLAYER_ID
		brightcovePlayerId: 'default',
	};

	return xsltTransform(
		article.bodyXML,
		`${process.cwd()}/server/stylesheets/main.xsl`,
		xsltParams
	)
	.catch(e => {
		console.log(e);
	});
}

module.exports = article => transformArticleBody(article.apiArticle);
