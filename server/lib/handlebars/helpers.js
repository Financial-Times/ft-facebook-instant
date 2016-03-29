'use strict';

const moment = require('moment');

module.exports = {
	rfcDate(timestamp) {
		const date = moment(parseInt(timestamp, 10));
		return date.format();
	},
	shortDate(timestamp) {
		const date = moment(parseInt(timestamp, 10));
		return date.format('MMMM D, YYYY');
	},
	relativeDate(timestamp) {
		const date = moment(parseInt(timestamp, 10));
		return date.fromNow();
	},
	ifEqual(a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	},
};
