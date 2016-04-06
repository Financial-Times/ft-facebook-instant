'use strict';

const invalidLinkSelector = 'a[href]:not([href^=http]):not([href^=mailto])';

module.exports = $ => Promise.resolve()
.then(() => {
	$(invalidLinkSelector).each((index, el) => {
		const $el = $(el);
		$el.replaceWith($el.contents());
	});
})
.then(() => $);
