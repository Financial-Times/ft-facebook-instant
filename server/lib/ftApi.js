'use strict';

const retry = require('./retry');
const fetchres = require('fetchres');
const uuidRegex = require('./uuid');
const FtApiContentMissingException = require('./ftApi/contentMissingException');

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
.catch(() => Promise.reject(new FtApiContentMissingException(`UUID [${uuid}] is not in Elastic Search`)));

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
.catch(() => Promise.reject(new FtApiContentMissingException(`Canonical URL [${canonical}] is not in Elastic Search`)));

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
.catch(() => Promise.reject(new FtApiContentMissingException(`UUID [${uuid}] is not in Elastic Search`)));

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
.catch(() => Promise.reject(new FtApiContentMissingException(`Key [${canonical}] is not a valid canonical URL`)));

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
.catch(e => {
	// Add extra detail to error object for Sentry
	e.tags = {from: 'updateEsRegion'};
	e.extra = {region, uuid};
	throw e;
});

const updateEs = uuid => Promise.all(['eu', 'us'].map(region => updateEsRegion(region, uuid)));

const fetchAsset = uuid => retry.fetch(
	`https://api.ft.com/content/items/v1/${uuid}?apiKey=${process.env.API_V1_KEY}`,
	{errorFrom: 'FtApi.fetchAsset', errorExtra: {uuid}}
)
.then(fetchres.json)
.catch(() => Promise.reject(new FtApiContentMissingException(`Asset [${uuid}] is not in Elastic Search`)));

module.exports = {
	fetchByUuid,
	fetchByCanonical,
	getCanonicalFromUuid,
	verifyCanonical,
	updateEs,
	fetchAsset,
};
