'use strict';

const insights = require('../lib/insights');
const moment = require('moment');

module.exports = (req, res, next) => {
	const timestamp = moment.utc()
		.startOf('hour')
		.valueOf();

	const since = moment.utc()
		.subtract(3, 'day')
		.format('YYYY-MM-DD');

	return insights.fetch({
		since,
		timestamp,
		firstRun: true,
	})
		.then(csv => {
			res.header('Content-Type', 'text/csv');
			res.send(csv);
		})
		.catch(next);
};
