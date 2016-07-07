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
		const paras = $('p');
		const position = Math.max(3, Math.floor(paras.length / 2));

		paras.eq(position).after(lightSignupMarkup(params));
	}

	return $;
};
