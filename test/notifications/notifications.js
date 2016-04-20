'use strict';

const notificationsController = require('../../build/controllers/notifications');
// const expect = require('../../test-utils/expect');

const database = require('../../build/lib/database');
// const ftApi = require('../../build/lib/ftApi');
// const articleModel = require('../../build/models/article');
const {stub} = require('sinon');
const resolveCname = require('denodeify')(require('dns').resolveCname);
const nock = require('nock');

const getCanonical = uuid => `http://www.ft.com/cms/s/0/${uuid}`;

const fakabase = {
	'http://www.ft.com/cms/s/0/94e97eee-ce9a-11e5-831d-09f7778e7377': {
		title: 'Article',
		uuid: '94e97eee-ce9a-11e5-831d-09f7778e7377',
	},
};

describe('Notifications controller', () => {
	before(() => {
		stub(database, 'get', function stubDatabaseGet(canonical) {
			if(Array.isArray(canonical)) {
				return Promise.all(canonical.map(stubDatabaseGet));
			}

			return Promise.resolve(fakabase[canonical]);
		});

		const mockEsRegion = region => nock(`https://ft-next-es-interface-${region}`)
			.put('/api/item')
			.reply({});

		['eu', 'us'].map(mockEsRegion);

		return resolveCname(process.env.ELASTIC_SEARCH_DOMAIN).then(([cname]) => {
			nock(`https://${cname}`)
				.persist()
				.post('/v3_api_v2/item/_search')
				.reply(
					(url, body) => JSON.stringify({
						hits: {
							hits: [{
								_source: {
									webUrl: getCanonical(JSON.parse(body).query.match['item.id']),
								},
							}],
						},
					})
				);
		});
	});

	after(() => {
	});

	it('should do a thing', () =>
		notificationsController.processNotifications({
			updates: ['94e97eee-ce9a-11e5-831d-09f7778e7377'],
		}).then(console.log.bind(console, 'RESOLVE'), console.error.bind(console, 'REJECT'))
	);
});
