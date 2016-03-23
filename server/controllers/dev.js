'use strict';

const database = require('../lib/database');

module.exports = (req, res) => {
	switch(req.params.action) {
		case 'wipe':
			return database.wipe()
				.then(result => res.send(`Database wiped: [${result}]`));
		default:
			res.sendStatus(404);
			break;
	}
};
