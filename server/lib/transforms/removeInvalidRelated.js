'use strict';

const fbApi = require('../fbApi');

const relatedSelector = '.op-related-articles';
const linkSelector = 'a';

module.exports = $ => Promise.resolve()
	.then(() => Promise.all($(relatedSelector).map((index, el) => {
		const $el = $(el);
		const href = $el.find(linkSelector).attr('href');
		return fbApi.get({id: href, type: 'related'}).then(({og_object}) => {
			if(og_object.type !== 'article') {
				$el.remove();
			}
		});
	}).toArray()))
	.then(() => $);
