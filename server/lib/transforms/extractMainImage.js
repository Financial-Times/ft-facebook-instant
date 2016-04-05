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
		const $figcaption = $('figcaption', $figure);
		if($figcaption) $figcaption.addClass('op-large');

		$figure.remove();
		return $.html($figure);
	}
};
