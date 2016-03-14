'use strict';

const renderer = require('../lib/renderer');

module.exports = (req, res) => {
	const uuid = req.params.uuid;
	res.send(`Processing ${uuid}`);
};
