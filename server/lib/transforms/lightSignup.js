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
	<iframe src="${formatLightSignupUrl(params)}" width="320" height="300"></iframe>
</figure>`;

module.exports = async function addLightSignup($, {warnings, params}) {
	if(params.enableLightSignup) {
		const paras = $.root().children('p');
		// Zero-indexed position
		const idealPosition = Math.max(3, Math.floor(paras.length / 2)) - 1;

		// Try to position in the middle of the article, working forwards until a suitable
		// place can be found
		let position = idealPosition;
		let prev = $(paras[position]).prev();
		while(prev && !prev.is('p') && position >= 3) {
			position--;
			prev = $(paras[position]).prev();
		}

		// If no place can be found after the 3rd paragraph, place at some point after the
		// middle
		if(position < 3) {
			position = idealPosition;
			let next = $(paras[position]).next();
			// Careful: `!next.is('p')` is true even for the last element!
			while(next.is('*') && !next.is('p')) {
				position++;
				next = $(paras[position]).next();
			}
		}

		paras.eq(position).after(lightSignupMarkup(params));
	}

	return $;
};
