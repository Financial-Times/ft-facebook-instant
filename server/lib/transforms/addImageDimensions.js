'use strict';

const fetch = require('node-fetch');
const fetchres = require('fetchres');
const statusCodes = require('http').STATUS_CODES;
const ravenClient = require('../raven');
const mode = require('../mode').get();

function getWidthAndRatio(metaUrl, options) {
	return fetch(metaUrl)
		.then(fetchres.json)
		.catch(err => {
			if(fetchres.originatedError(err)) {
				return Promise.reject(`Failed to get image metadata for ${metaUrl}. ${err.message}: ${statusCodes[err.message]}`);
			}

			return Promise.reject(err);
		})
		.then(
			meta => Object.assign(meta, {ratio: meta.height / meta.width}),
			(e) => {
				console.error(`${Date()}: addImageDimensions error for metaUrl [${metaUrl}]: ${e.stack || e}`);
				if(mode === 'production') {
					ravenClient.captureException(e, {
						tags: {from: 'addImageDimensions'},
						extra: {metaUrl},
					});
				}
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
