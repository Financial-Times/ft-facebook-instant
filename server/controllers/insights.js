'use strict';

const insights = require('../lib/insights');
const ravenClient = require('../lib/raven').client;
const promiseLoopInterval = require('@quarterto/promise-loop-interval');
const UPDATE_INTERVAL = 1 * 60 * 1000;

const fetch = () => {
	console.log(`${Date()}: INSIGHTS_FETCH periodic fetch starting now`);
	return insights.fetch({
		upload: true,
	})
	.then(() => {
		console.log(`${Date()}: INSIGHTS_FETCH periodic fetch complete`);
	})
	.catch(e => {
		console.error(`${Date()}: INSIGHTS_FETCH periodic fetch failed with error: ${e.stack || e}`);
		ravenClient.captureException(e, {tags: {from: 'insights'}});
	});
};

const init = promiseLoopInterval(fetch, UPDATE_INTERVAL);

module.exports = {
	init,
};
