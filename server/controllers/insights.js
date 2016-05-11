'use strict';

const moment = require('moment');
const insights = require('../lib/insights');

module.exports = (req, res, next) => {
	const since = moment.utc()
		.startOf('hour')
		.subtract(1, 'month');

	return insights.fetch({
		since,
	})
	.then(() => {
		res.send('done');
	})
	.catch(next);
};
