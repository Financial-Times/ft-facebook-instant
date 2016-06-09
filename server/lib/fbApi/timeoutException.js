'use strict';

const util = require('util');

function FbApiTimeoutException(message) {
	this.message = message;
	this.type = 'FbApiTimeoutException';
	Error.call(this);
	if(Error.captureStackTrace) Error.captureStackTrace(this, FbApiTimeoutException);
}

util.inherits(FbApiTimeoutException, Error);

module.exports = FbApiTimeoutException;
