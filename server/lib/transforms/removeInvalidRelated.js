'use strict';

const fbApi = require('../fbApi');

const relatedSelector = '.op-related-articles';
const linkSelector = 'a';

module.exports = ($, warnings) => Promise.resolve()
	.then(() => Promise.all($(relatedSelector).map((index, el) => {
		const $el = $(el);
		const href = $el.find(linkSelector).attr('href');
		if(!href) {
			return Promise.resolve();
		}
		return fbApi.get({id: href, type: 'related'}).then(({ogObject}) => {
			if(!ogObject) {
				return;
			}
			if(!ogObject.title) {
				$el.remove();
				warnings.push(`Removed invalid related article with link to [${ogObject.url}]`);
			}
		});
	}).toArray()))
	.then(() => $);
