'use strict';

const replaceHtml = ($, el) => {
	const $youtube = $(el);

	const width = 640;
	const height = 360;
	const videoId = $youtube.attr('data-video-id');

	const src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;

	$youtube.replaceWith($(`<figure class="op-interactive"><iframe width="${width}" height="${height}" src="${src}"></iframe></figure>`));
};

module.exports = $ => Promise.resolve()
.then(() => {
	$('youtube').map((index, el) => replaceHtml($, el));
})
.then(() => $);
