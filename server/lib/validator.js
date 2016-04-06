'use strict';

module.exports = $ => {
	const invalid = [];

	$('ft-slideshow').each((index, el) => {
		const $el = $(el);
		const cl = ($el.attr('class') || '').split(' ').join('.');
		invalid.push(`${el.tagName}${cl && '.' + cl}`);
	});

	if(!invalid.length) return;
	throw Error(`This article contains the following unsupported HTML elements: ${invalid.join(', ')}`);
};
