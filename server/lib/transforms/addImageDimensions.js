'use strict';

const retry = require('../retry');
const fetchres = require('fetchres');

function getWidthAndRatio(metaUrl, options) {
	return retry.fetch(metaUrl, {
		errorFrom: 'getWidthAndRatio',
		errorExtra: {metaUrl},
		asJson: true,
	})
		.then(
			meta => Object.assign(meta, {ratio: meta.height / meta.width}),
			(e) => {
				console.error(`${Date()}: addImageDimensions error for metaUrl [${metaUrl}]: ${e.stack || e}`);
				return {width: 600, ratio: 4 / 7};
			}
		);
}

module.exports = $ => Promise.all($('img[src]').map((index, el) => {
	const $img = $(el);
	const src = $img.attr('src');

	const metaUrl = `https://h2.ft.com/image/v1/images/metadata/${encodeURIComponent(src)}?source=facebook-instant`;
	return getWidthAndRatio(metaUrl)
		.then(meta => {
			$img.attr({
				width: meta.width,
				height: meta.height,
			});
		});
}).toArray())
.then(() => $);
