'use strict';

const database = require('../lib/database');

module.exports = (req, res) => {
	switch(req.params.action) {
		case 'dbwipe':
			database.wipe()
				.then(result => console.log('Database wiped', result))
				.then(() => res.send('wiped'));
			break;
		default:
			res.sendStatus(404);
			break;
	}
};
