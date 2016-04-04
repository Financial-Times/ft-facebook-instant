'use strict';

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

		const width = $img.attr('width');
		const height = $img.attr('height');
		console.log({width, height});

		return $figure.html();
	}
};
