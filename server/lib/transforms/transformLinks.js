'use strict';

const addSegmentId = require('../segmentId');
const linkSelector = 'a[href]';

module.exports = $ => Promise.resolve()
.then(() => {
	$(linkSelector).each((index, link) => {
		const $link = $(link);
		$link.attr('href', addSegmentId($link.attr('href')));
	});
})
.then(() => $);
