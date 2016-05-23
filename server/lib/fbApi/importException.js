'use strict';

const util = require('util');

function FbApiImportException(message) {
	this.message = message;
	this.type = 'FbApiImportException';
	Error.call(this);
	if(Error.captureStackTrace) Error.captureStackTrace(this, FbApiImportException);
}

util.inherits(FbApiImportException, Error);

module.exports = FbApiImportException;
