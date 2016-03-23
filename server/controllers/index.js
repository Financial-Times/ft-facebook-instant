'use strict';

const testUuids = require('../lib/testUuids');

module.exports = (req, res, next) => Promise.resolve()
.then(() => res.render('index', {
	testUuids,
}))
.catch(next);
