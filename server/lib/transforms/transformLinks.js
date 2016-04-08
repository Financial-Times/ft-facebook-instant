'use strict';

const url = require('url');
const linkSelector = 'a[href]';
const SEGMENT_ID = process.env.SEGMENT_ID;

module.exports = $ => Promise.resolve()
.then(() => {
	$(linkSelector).each((index, link) => {
		const $link = $(link);
		const href = $link.attr('href');
		if(href.match(/^https?:\/\/[^\/]+\.ft\.com/)) {
			const parsed = url.parse(href, true);
			delete parsed.search;
			parsed.query.segmentid = SEGMENT_ID;
			$link.attr('href', url.format(parsed));
		}
	});
})
.then(() => $);
