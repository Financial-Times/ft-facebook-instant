'use strict';

module.exports = $ => Promise.resolve()
.then(() => {
	const body = $('body');
	body.replaceWith(body.children());
})
.then(() => $);
