'use strict';

const url = require('url');
const SEGMENT_ID = process.env.SEGMENT_ID;

module.exports = href => {
	if(!href.match(/^https?:\/\/[^\/]+\.ft\.com/)) return href;

	const parsed = url.parse(href, true);
	delete parsed.search;
	parsed.query.segmentid = SEGMENT_ID;
	return url.format(parsed);
};
