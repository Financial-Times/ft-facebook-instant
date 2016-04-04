'use strict';

module.exports = $ => {
	// find image in the body
	const $firstMainImage = $('figure.n-content-image, ft-slideshow').eq(0);

	// check that it is the first element in the body
	if(
		$firstMainImage.length &&
			!$firstMainImage.prev().length &&
			(!$firstMainImage.parent() || !$firstMainImage.parent().prev().length)
	) {
		return $.html($firstMainImage.remove());
	}
};
