'use strict';

const minWidth = 1024;
const minHeight = 1024;

module.exports = $ => {
	// find image in the body
	const $figure = $('figure').eq(0);

	// check that it is the first element in the body
	if(
		$figure.length &&
		!$figure.prev().length &&
		(!$figure.parent() || !$figure.parent().prev().length)
	) {
		const $img = $('img', $figure);
		const $figcaption = $('figcaption', $figure);

		const width = parseInt($img.attr('width'), 10);
		const height = parseInt($img.attr('height'), 10);

		if(width < minWidth || height < minHeight) {
			return;
		}

		if($figcaption) $figcaption.addClass('op-large');

		$figure.remove();
		return $.html($figure);
	}
};
