'use strict';

const util = require('util');

function RichError(message, metadata = {}) {
	this.message = message;
	this.type = 'RichError';
	Error.call(this);
	if(Error.captureStackTrace) Error.captureStackTrace(this, RichError);

	// Copy all metadata fields to the Error object to be later sent to Sentry
	Object.keys(metadata).forEach(field => (this[field] = metadata[field]));
}

util.inherits(RichError, Error);

module.exports = RichError;
