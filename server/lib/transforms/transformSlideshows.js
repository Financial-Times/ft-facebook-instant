'use strict';

const fetch = require('node-fetch');
const fetchres = require('fetchres');
const handlebarsTransform = require('../handlebars').render;

const fetchSlideshow = uuid => fetch(`https://api.ft.com/content/items/v1/${uuid}?apiKey=${process.env.API_V1_KEY}`)
.then(fetchres.json)
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
.catch(e => Promise.reject(new Error(`Failed to fetch slideshow for UUID ${uuid}. Error: [${e.toString()}]`)));

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
