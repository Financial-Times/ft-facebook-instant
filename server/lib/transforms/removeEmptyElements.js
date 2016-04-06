'use strict';

module.exports = $ => Promise.resolve()
.then(() => {
	// Add any elements to this list which are being passed through with no text content
	$('p, strong, em').each((index, el) => {
		const $el = $(el);
		if($el.text().length === 0) $el.remove();
	});
})
.then(() => $);
