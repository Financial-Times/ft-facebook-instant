'use strict';

const database = require('../lib/database');
const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');

module.exports = (req, res, next) => {
	switch(req.params.action) {
		case 'wipe':
			return Promise.all([
				fbApi.wipe(),
				database.wipe(),
			])
			.then(([fb, db]) => res.json({message: 'All wiped', fb, db}));
		case 'wipedb':
			return database.wipe()
				.then(result => res.json({message: 'Database wiped', result}));
		case 'wipefb':
			return fbApi.wipe()
				.then(result => res.json({message: 'Facebook wiped', result}));
		case 'listdb':
			return database.list()
				.then(result => res.json(result))
				.catch(next);
		case 'listfb':
			return fbApi.list()
				.then(result => res.json(result))
				.catch(next);
		case 'findfb':
			return fbApi.find({canonical: 'http://www.ft.com/cms/s/2/94e97eee-ce9a-11e5-831d-09f7778e7377.html'})
				.then(result => res.json(result))
				.catch(next);
		case 'introspectimport':
			return fbApi.introspect({id: 263911067276234})
				.then(result => res.json(result))
				.catch(next);
		case 'introspectarticle':
			return fbApi.introspect({id: 1570385226586485})
				.then(result => res.json(result))
				.catch(next);
		case 'postfb':
			return fbApi.post({html: 'blah'})
				.then(result => res.json(result))
				.catch(next);
		case 'importstatus':
			return fbApi.get({type: 'import', id: 263911067276234})
				.then(result => res.json(result))
				.catch(next);
		case 'article':
			return fbApi.get({type: 'article', id: 1570385226586485})
				.then(result => res.json(result))
				.catch(next);
		case 'deletefb':
			return fbApi.delete({id: 474757556051614})
				.then(result => res.json(result))
				.catch(next);
		case 'fetchByCanonical':
			return ftApi.fetchByCanonical('http://blogs.ft.com/tech-blog/2016/02/techft-from-phones-to-drones-at-mwc/')
				.then(result => res.json(result))
				.catch(next);
		case 'getCanonicalFromUuid':
			return ftApi.getCanonicalFromUuid('2f1774f4-ab65-11e3-aad9-00144feab7de')
				.then(result => res.json(result))
				.catch(next);
		case 'apiFetch':
			return ftApi.fetch('3ee29f96-88e0-11e3-bb5f-00144feab7de')
				.then(result => res.json(result))
				.catch(next);
		default:
			res.sendStatus(404);
			break;
	}
};
