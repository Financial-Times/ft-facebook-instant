'use strict';

const url = require('url');

const formatLightSignupUrl = ({lightSignupUrl, lightSignupProduct, lightSignupMailinglist, uuid}) => url.format({
	...url.parse(lightSignupUrl),
	query: {
		article: uuid,
		product: lightSignupProduct,
		mailinglist: lightSignupMailinglist,
	},
});

const lightSignupMarkup = params => `<figure class="op-interactive">
	<iframe src="${formatLightSignupUrl(params)}" width="320" height="350"></iframe>
</figure>`;

module.exports = async function addLightSignup($, {warnings, params}) {
	if(params.enableLightSignup) {
		const paras = $.root().children('p');

		// Zero-indexed position
		const idealPosition = Math.max(3, Math.floor(paras.length / 2)) - 1;
		const maxPosition = paras.length - 1;

		let position = idealPosition;

		// Try to position in the middle of the article, working up until a suitable
		// place can be found
		while(!paras.eq(position).next().is('p') && position >= 3) {
			position--;
		}

		// If no place can be found in the first half of the article, place at some point
		// after the middle
		if(position < 3) {
			position = idealPosition;
			while(!paras.eq(position).next().is('p') && position < maxPosition) {
				position++;
			}
		}

		paras.eq(position).after(lightSignupMarkup(params));
	}

	return $;
};
