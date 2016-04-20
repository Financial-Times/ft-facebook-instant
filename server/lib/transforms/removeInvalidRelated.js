'use strict';

const checkLink = require('../related/checkLink');

const relatedSelector = '.op-related-articles';
const linkSelector = 'a';

module.exports = ($, warnings) => Promise.resolve()
	.then(() => Promise.all($(relatedSelector).map((index, el) => {
		const $el = $(el);
		const href = $el.find(linkSelector).attr('href');
		if(!href) {
			return Promise.resolve();
		}
		return checkLink(href).then(isValid => {
			if(!isValid) {
				$el.remove();
				warnings.push(`Removed invalid related article with link to [${href}]`);
			}
		});
	}).toArray()))
	.then(() => $);
