'use strict';

const fbApi = require('../lib/fbApi');

module.exports = function() {
	fbApi.links().then(console.log, console.error);
};
