'use strict';
const express = require('express');
const ftwebservice = require('express-ftwebservice');
const path = require('path');

const port = process.env.PORT || 6247;
const app = express();

ftwebservice(app, {
	manifestPath: path.join(__dirname, 'package.json'),
	about: {
		schemaVersion: 1,
		name: 'facebook-instant',
		purpose: 'Serve Facebook Instant Articles RSS feed and admin UI',
		audience: 'private',
		primaryUrl: 'https://facebookinstant.ft.com',
		serviceTier: 'bronze',
		appVersion: process.env.HEROKU_RELEASE_VERSION,
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
});

app.listen(port, () => console.log('Up and running on port', port));
