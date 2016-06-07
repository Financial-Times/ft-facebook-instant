'use strict';

const path = require('path');
const {version} = require('../../package.json');

module.exports = {
	manifestPath: path.resolve(__dirname, '../../package.json'),
	about: {
		schemaVersion: 1,
		name: 'facebook-instant',
		purpose: 'Serve Facebook Instant Articles Admin UI',
		audience: 'private',
		primaryUrl: 'https://facebookinstant.ft.com',
		serviceTier: 'bronze',
		appVersion: version,
		contacts: [
			{
				name: 'Richard Still',
				email: 'richard.still@ft.com',
			},
			{
				name: 'Matthew Brennan',
				email: 'matthew.brennan@ft.com',
			},
			{
				name: 'George Crawford',
				email: 'george.crawford@ft.com',
			},
		],
	},
	goodToGoTest() {
		const checks = [];
		return Promise.all(checks);
	},
	healthCheck() {
		const checks = [];
		return Promise.all(checks);
	},
};
