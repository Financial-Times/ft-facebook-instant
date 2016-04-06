'use strict';

// Add any elements to this list which are being passed through with no text content
const elementsToCheck = [
	'p',
	'strong',
	'em',
];

module.exports = $ => Promise.resolve()
.then(() => {
	$(elementsToCheck.join(', ')).each((index, el) => {
		const $el = $(el);
		if($el.text().length === 0) $el.remove();
	});
})
.then(() => $);
