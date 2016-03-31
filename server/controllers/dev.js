'use strict';

const database = require('../lib/database');
const fbApi = require('../lib/fbApi');

module.exports = (req, res, next) => {
	switch(req.params.action) {
		case 'wipedb':
			return database.wipe()
				.then(result => res.json({message: 'Database wiped', result}));
		case 'wipefb':
			return fbApi.wipe()
				.then(result => res.json({message: 'Facebook wiped', result}));
		case 'listfb':
			return fbApi.list({mode: 'development', fields: []})
				.then(result => res.json(result))
				.catch(next);
		case 'findfb':
			return fbApi.find({canonical: 'http://www.ft.com/cms/s/2/94e97eee-ce9a-11e5-831d-09f7778e7377.html'})
				.then(result => res.json(result))
				.catch(next);
		case 'introspectimport':
			return fbApi.introspect({id: 923283007789377})
				.then(result => res.json(result))
				.catch(next);
		case 'introspectarticle':
			return fbApi.introspect({id: 1000105006750035})
				.then(result => res.json(result))
				.catch(next);
		case 'postfb':
			return fbApi.post({html: 'blah'})
				.then(result => res.json(result))
				.catch(next);
		case 'importstatus':
			return fbApi.get({type: 'import', id: 923283007789377})
				.then(result => res.json(result))
				.catch(next);
		case 'article':
			return fbApi.get({type: 'article', id: 1000105006750035})
				.then(result => res.json(result))
				.catch(next);
		case 'deletefb':
			return fbApi.delete({id: 474757556051614})
				.then(result => res.json(result))
				.catch(next);
		default:
			res.sendStatus(404);
			break;
	}
};
