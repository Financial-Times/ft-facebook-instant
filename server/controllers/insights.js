'use strict';

const moment = require('moment');
const insights = require('../lib/insights');

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
	.then(() => {
		res.send('done');
	})
	.catch(next);
};
