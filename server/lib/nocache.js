'use strict';

module.exports = (req, res, next) => {
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.header('Expires', '-1');
	res.header('Pragma', 'no-cache');

	// No-cache actions can take a while so set the timeout to infinite...
	res.connection.setTimeout(0);

	next();
};
