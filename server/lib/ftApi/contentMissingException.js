'use strict';

const util = require('util');

function FtApiContentMissingException(message) {
	this.message = message;
	this.type = 'FtApiContentMissingException';
	Error.call(this);
	if(Error.captureStackTrace) Error.captureStackTrace(this, FtApiContentMissingException);
}

util.inherits(FtApiContentMissingException, Error);

module.exports = FtApiContentMissingException;
