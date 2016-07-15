'use strict';

const util = require('util');
const nodeFetch = require('node-fetch');
const signedFetch = require('signed-aws-es-fetch');
const RichError = require('./richError');
const DEFAULT_ITERATIONS = 3;

function RetryableException(actualException) {
	this.message = actualException.message;
	this.actualException = actualException;
	this.type = 'RetryableException';
	Error.call(this);
	if(Error.captureStackTrace) Error.captureStackTrace(this, RetryableException);
}

util.inherits(RetryableException, Error);


function retry(f, maxIterations = DEFAULT_ITERATIONS, iteration = 0) {
	iteration++;
	return f()
		.catch(e => {
			if(e instanceof RetryableException) {
				if(iteration < maxIterations) {
					// Recurse
					return retry(f, maxIterations, iteration);
				}
				e.actualException.type = 'RetryMaxIterationsError';
				throw e.actualException;
			}
			// Rethrow
			throw e;
		});
}

const fetch = (url, options = {}) => {
	const maxIterations = options.retry || DEFAULT_ITERATIONS;
	const from = options.errorFrom || 'unknown';
	const extra = options.errorExtra || {};
	const fn = options.signedAws ? signedFetch : nodeFetch;

	delete options.retry;
	delete options.errorFrom;
	delete options.errorExtra;
	delete options.signedAws;

	return retry(
		() => fn(url, options)
			.catch(e => {
				if(e.message.toLowerCase().indexOf('timeout') > -1) {
					throw new RetryableException(e);
				}
				throw e;
			}),
		maxIterations
	)
	.catch(e => Promise.reject(
		new RichError(e.message || 'retry.fetch failed', {
			tags: {from},
			type: e.type,
			extra: Object.assign({maxIterations, url, options, e}, extra),
		})
	));
};

module.exports = (fn, maxIterations) => retry(fn, maxIterations);
module.exports.fetch = fetch;
module.exports.RetryableException = RetryableException;
