'use strict';

const retry = require('./retry');
const fetchres = require('fetchres');
const uuidRegex = require('./uuid');
const RichError = require('./richError');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';

const fetchByUuid = uuid => retry.fetch(
	`https://${elasticSearchUrl}/${index}/item/${uuid}`,
	{
		signedAws: true,
		errorFrom: 'FtApi.fetchByUuid',
		errorExtra: {uuid},
	}
)
.then(fetchres.json)
.then(json => json._source || Promise.reject(Error('not found')))
.catch(e => Promise.reject(
	new RichError('UUID is not in Elastic Search', {
		type: 'FtApiContentMissingException',
		tags: {from: 'fetchByUuid'},
		extra: {uuid, e},
	})
));

const fetchByCanonical = canonical => retry.fetch(
	`https://${elasticSearchUrl}/${index}/_search`,
	{
		signedAws: true,
		errorFrom: 'FtApi.fetchByCanonical',
		errorExtra: {canonical},
		method: 'POST',
		body: JSON.stringify({
			query: {
				match: {
					'item.webUrl': canonical,
				},
			},
		}),
	}
)
.then(fetchres.json)
.then(json => {
	try{
		return json.hits.hits[0]._source;
	} catch(e) {
		const uuid = (uuidRegex.exec(canonical) || [])[0];
		if(uuid) {
			return fetchByUuid(uuid);
		}

		throw Error('No result');
	}
})
.catch(e => Promise.reject(
	new RichError('Error fetching canonical URL from Elastic Search', {
		type: 'FtApiContentMissingException',
		tags: {from: 'fetchByCanonical'},
		extra: {canonical, e},
	})
));

const getCanonicalFromUuid = uuid => retry.fetch(
	`https://${elasticSearchUrl}/${index}/item/_search`,
	{
		signedAws: true,
		errorFrom: 'FtApi.getCanonicalFromUuid',
		errorExtra: {uuid},
		method: 'POST',
		body: JSON.stringify({
			query: {
				match: {
					'item.id': uuid,
				},
			},
			_source: 'webUrl',
		}),
	}
)
.then(fetchres.json)
.then(json => {
	try{
		return json.hits.hits[0]._source.webUrl;
	} catch(e) {
		throw Error('No result');
	}
})
.catch(e => Promise.reject(
	new RichError('Error fetching UUID from Elastic Search', {
		type: 'FtApiContentMissingException',
		tags: {from: 'getCanonicalFromUuid'},
		extra: {uuid, e},
	})
));

const verifyCanonical = canonical => retry.fetch(
	`https://${elasticSearchUrl}/${index}/_search`,
	{
		signedAws: true,
		errorFrom: 'FtApi.verifyCanonical',
		errorExtra: {canonical},
		method: 'POST',
		body: JSON.stringify({
			query: {
				match: {
					'item.webUrl': canonical,
				},
			},
			_source: 'webUrl',
		}),
	}
)
.then(fetchres.json)
.then(json => {
	try{
		return json.hits.hits[0]._source.webUrl;
	} catch(e) {
		throw Error('No result');
	}
})
.catch(e => Promise.reject(
	new RichError('Error verifying canonical URL', {
		type: 'FtApiContentMissingException',
		tags: {from: 'verifyCanonical'},
		extra: {canonical, e},
	})
));

const updateEsRegion = (region, uuid) => retry.fetch(
	`https://ft-next-es-interface-${region}.herokuapp.com/api/item?apiKey=${process.env.ES_INTERFACE_API_KEY}`,
	{
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({id: uuid}),
		errorFrom: 'FtApi.updateEsRegion',
		errorExtra: {region, uuid},
	}
)
.then(fetchres.json)
.catch(e => Promise.reject(
	new RichError('Failed to update ES region', {
		tags: {from: 'updateEsRegion'},
		extra: {region, uuid},
	})
));

const updateEs = uuid => Promise.all(['eu', 'us'].map(region => updateEsRegion(region, uuid)));

const fetchAsset = uuid => retry.fetch(
	`https://api.ft.com/content/items/v1/${uuid}?apiKey=${process.env.API_V1_KEY}`,
	{errorFrom: 'FtApi.fetchAsset', errorExtra: {uuid}}
)
.then(fetchres.json)
.catch(e => Promise.reject(
	new RichError('Asset is not in Elastic Search', {
		type: 'FtApiContentMissingException',
		tags: {from: 'fetchAsset'},
		extra: {uuid, e},
	})
));

module.exports = {
	fetchByUuid,
	fetchByCanonical,
	getCanonicalFromUuid,
	verifyCanonical,
	updateEs,
	fetchAsset,
};
