'use strict';

const util = require('util');

function DbParseException(message) {
	this.message = message;
	this.type = 'DbParseException';
	Error.call(this);
	if(Error.captureStackTrace) Error.captureStackTrace(this, DbParseException);
}

util.inherits(DbParseException, Error);

module.exports = DbParseException;
