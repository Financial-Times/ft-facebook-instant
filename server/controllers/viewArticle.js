'use strict';

module.exports = (req, res) => {
	const uuid = req.params.uuid;
	res.send(`Processing ${uuid}`);
};
