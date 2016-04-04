'use strict';
const fetchHead = require('@quarterto/fetch-head');

module.exports = (metadatum) => {
	const streamUrl = `http://www.ft.com/stream/${metadatum.taxonomy}Id/${metadatum.idV1}`;
	const headers = {};

	// Set User-Agent (to avoid Akamai blocking the request), and client IP
	// to avoid rate-limiting by IP.
	// @nocommit
	headers['user-agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2667.0 Safari/537.36';
	headers['x-forwarded-for'] = '::1';
	headers['true-client-ip'] = '::1';

	return fetchHead(streamUrl, {
		headers,
	})
		.then(res => (console.log({headers, streamUrl, status: res.status}), res))
		.then(res => res.status >= 200 && res.status < 400 && streamUrl);
};
