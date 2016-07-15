'use strict';

const util = require('util');
const scrubbers = ['password', 'secret', 'passwd', 'authorization', 'api_key', 'apikey', 'access_token'];

const unscrub = value => {
	let ret;
	switch(Object.prototype.toString.call(value)) {
		case '[object Array]':
			return value.map(unscrub);
		case '[object Object]':
			ret = {};
			Object.keys(value).forEach(field => {
				ret[field] = unscrub(value[field]);
			});
			return ret;
		case '[object String]':
			scrubbers.forEach(key => {
				value = value.replace(new RegExp(`${key}((.{25})|(.*$))`, 'mg'), `[FILTERED]${key.split('').join(' ')}...[/FILTERED]`);
			});
			return value;
		default:
			return value;
	}
};

function RichError(message, metadata = {}) {
	this.message = message;
	this.type = 'RichError';
	Error.call(this);
	if(Error.captureStackTrace) Error.captureStackTrace(this, RichError);

	// Copy all metadata fields to the Error object to be later sent to Sentry
	Object.keys(metadata).forEach(field => {
		this[field] = unscrub(metadata[field]);
	});
}

util.inherits(RichError, Error);

module.exports = RichError;
