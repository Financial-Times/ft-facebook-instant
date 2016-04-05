'use strict';

const targetAspectRatio = 4 / 3; // See https://developers.facebook.com/docs/instant-articles/reference/cover

module.exports = $ => {
	// find image in the body
	const $figure = $('figure').eq(0);

	// check that it is the first element in the body
	if(
		$figure.length &&
			!$figure.prev().length &&
			(!$figure.parent() || !$figure.parent().prev().length)
	) {
		$figure.remove();

		const $img = $('img', $figure);

		const width = parseInt($img.attr('width'), 10);
		const height = parseInt($img.attr('height'), 10);
		const ratio = width / height;

		let targetWidth, targetHeight;
		// if(ratio > targetAspectRatio) {
		// 	targetWidth =
		// }

		console.log({width, height, ratio});

		return $.html($figure);
	}
};
