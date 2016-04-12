'use strict';

const fbApi = require('../fbApi');
const articleModel = require('../../models/article');

const relatedSelector = '.op-related-articles';
const linkSelector = 'a';

module.exports = ($, warnings) => Promise.resolve()
	.then(() => Promise.all($(relatedSelector).map((index, el) => {
		const $el = $(el);
		const href = $el.find(linkSelector).attr('href');
		if(!href) {
			return Promise.resolve();
		}
		return articleModel.getCanonical(href)
			.catch(() => null)
			.then(canonical => canonical || href)
			.then(url => fbApi.get({id: url, type: 'related'})
				.then(({og_object: ogObject}) => {
					if(!ogObject) {
						return;
					}
					if(!ogObject.title) {
						$el.remove();
						warnings.push(`Removed invalid related article with link to [${ogObject.url}]`);
					}
				})
			);
	}).toArray()))
	.then(() => $);
