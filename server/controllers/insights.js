'use strict';

const insights = require('../lib/insights');

module.exports = (req, res, next) => insights.fetch()
.then(csv => {
	res.header('Content-Type', 'text/csv');
	res.send(csv);
})
.catch(next);
