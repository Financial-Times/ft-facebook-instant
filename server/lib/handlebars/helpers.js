'use strict';
/* eslint no-var: "off", vars-on-top: "off" */

var moment = require('moment');

exports.rfcDate = function rfcDate(timestamp) {
	var date = moment(parseInt(timestamp, 10));
	return date.format();
};

exports.shortDate = function shortDate(timestamp) {
	if(!timestamp) return 'unknown timestamp';
	var date = moment(parseInt(timestamp, 10));
	return date.format('MMMM D, YYYY');
};

exports.relativeDate = function relativeDate(timestamp) {
	if(!timestamp) return 'unknown timestamp';
	var date = moment(parseInt(timestamp, 10));
	return date.fromNow();
};

exports.ifEqual = function ifEqual(a, b, options) {
	return a === b ? options.fn(this) : options.inverse(this);
};

exports.encodeURIComponent = function encodeURIComponent_(val) {
	return encodeURIComponent(val);
};

exports.humanMode = function humanMode(mode) {
	return mode.charAt(0).toUpperCase() + mode.slice(1);
};

exports.or = function or(a, b, options) {
	return (a || b) ? options.fn(this) : options.inverse(this);
};

exports.lowercase = function lowercase(str) {
	return str.toLowerCase();
};
