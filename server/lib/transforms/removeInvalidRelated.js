'use strict';

const checkLinks = require('../related/checkLinks');

const relatedSelector = '.op-related-articles';
const linkSelector = 'a';

module.exports = ($, warnings) => Promise.resolve()
	.then(() => {
		const related = [];
		$(relatedSelector).each((index, el) => {
			const $el = $(el);
			const href = $el.find(linkSelector).attr('href');
			if(!href) {
				return;
			}

			related.push({
				$el,
				href,
			});
		});

		return checkLinks(related.map(link => link.href))
			.then(urls => urls.forEach((url, index) => {
				if(!url) {
					related[index].$el.remove();
					warnings.push(`Removed invalid related article with link to [${related[index].href}]`);
				}
			}));
	})
	.then(() => $);
