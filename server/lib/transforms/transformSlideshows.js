'use strict';

const handlebarsTransform = require('../handlebars').render;
const ftApi = require('../ftApi');
const database = require('../database');

const fetchSlideshow = uuid => database.getCapi(uuid)
.then(cached => {
	if(cached) {
		return cached;
	}

	return ftApi.fetchAsset(uuid)
		.then(data => {
			if(data
				&& data.item
				&& data.item.assets
				&& data.item.assets[0]
				&& data.item.assets[0].type === 'slideshow') {
				return {
					uuid,
					title: data.item.assets[0].fields.title,
					slides: data.item.assets[0].fields.slides,
				};
			}

			throw Error(`No slideshow asset found for UUID ${uuid}`);
		})
		.then(asset => database.setCapi(uuid, asset))
		.catch(e => Promise.reject(new Error(`Failed to fetch slideshow for UUID ${uuid}. Error: [${e.toString()}]`)));
});

module.exports = function externalImages($, options) {
	return Promise.all($('ft-slideshow[data-uuid]').map((index, placeholder) => {
		const $placeholder = $(placeholder);
		const uuid = $placeholder.attr('data-uuid');
		return fetchSlideshow(uuid)
			.then(slideshow => handlebarsTransform(`${process.cwd()}/views/templates/slideshow.html`, slideshow)
				.then(html => {
					$placeholder.replaceWith($(html));
				})
			)
			.catch(e => {
				$placeholder.remove();
				throw e;
			});
	}).toArray()).then(() => $);
};
