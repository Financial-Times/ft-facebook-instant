'use strict';

const moment = require('moment');

module.exports = {
	rfcDate(timestamp) {
		const date = moment(parseInt(timestamp, 10));
		return date.format();
	},
	shortDate(timestamp) {
		if(!timestamp) return 'unknown timestamp';
		const date = moment(parseInt(timestamp, 10));
		return date.format('MMMM D, YYYY');
	},
	relativeDate(timestamp) {
		if(!timestamp) return 'unknown timestamp';
		const date = moment(parseInt(timestamp, 10));
		return date.fromNow();
	},
	ifEqual(a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	},
	encodeURIComponent(val) {
		return encodeURIComponent(val);
	},
	humanMode(mode) {
		return mode.charAt(0).toUpperCase() + mode.slice(1);
	},
	or(a, b, options) {
		return (a || b) ? options.fn(this) : options.inverse(this);
	},
	lowercase(str) {
		return str.toLowerCase();
	},
};
