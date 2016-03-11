"use strict";

const feed = require('../lib/feed');

module.exports = (req, res) => {
	res.send(feed.generate());
};
