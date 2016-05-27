'use strict';

const moment = require('moment');
const insights = require('../lib/insights');
const promiseLoopInterval = require('@quarterto/promise-loop-interval');
const UPDATE_INTERVAL = 1 * 60 * 1000;

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

const fetch = () => {
	const since = moment.utc()
		.startOf('hour')
		.subtract(1, 'month');

	console.log(`${Date()}: INSIGHTS_FETCH periodic fetch starting now`);
	return insights.fetch({
		since,
		upload: true,
	})
	.then(() => {
		console.log(`${Date()}: INSIGHTS_FETCH periodic fetch complete`);
	});
};

const init = promiseLoopInterval(fetch, UPDATE_INTERVAL);

module.exports = {
	init,
};
