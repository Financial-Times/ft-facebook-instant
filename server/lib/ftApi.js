'use strict';

const nodeFetch = require('node-fetch');
const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');
const uuidRegex = require('./uuid');
const FtApiContentMissingException = require('./ftApi/contentMissingException');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';

const fetchByUuid = uuid => signedFetch(`https://${elasticSearchUrl}/${index}/item/${uuid}`)
.then(fetchres.json)
.then(json => json._source || Promise.reject(Error('not found')))
.catch(() => Promise.reject(new FtApiContentMissingException(`UUID [${uuid}] is not in Elastic Search`)));

const fetchByCanonical = canonical => signedFetch(`https://${elasticSearchUrl}/${index}/_search`, {
	method: 'POST',
	body: JSON.stringify({
		query: {
			match: {
				'item.webUrl': canonical,
			},
		},
	}),
})
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

const getCanonicalFromUuid = uuid => signedFetch(`https://${elasticSearchUrl}/${index}/item/_search`, {
	method: 'POST',
	body: JSON.stringify({
		query: {
			match: {
				'item.id': uuid,
			},
		},
		_source: 'webUrl',
	}),
})
.then(fetchres.json)
.then(json => {
	try{
		return json.hits.hits[0]._source.webUrl;
	} catch(e) {
		throw Error('No result');
	}
})
.catch(() => Promise.reject(new FtApiContentMissingException(`UUID [${uuid}] is not in Elastic Search`)));

const verifyCanonical = canonical => signedFetch(`https://${elasticSearchUrl}/${index}/_search`, {
	method: 'POST',
	body: JSON.stringify({
		query: {
			match: {
				'item.webUrl': canonical,
			},
		},
		_source: 'webUrl',
	}),
})
.then(fetchres.json)
.then(json => {
	try{
		return json.hits.hits[0]._source.webUrl;
	} catch(e) {
		throw Error('No result');
	}
})
.catch(() => Promise.reject(new FtApiContentMissingException(`Key [${canonical}] is not a valid canonical URL`)));

const updateEsRegion = (region, uuid) => nodeFetch(
	`https://ft-next-es-interface-${region}.herokuapp.com/api/item?apiKey=${process.env.ES_INTERFACE_API_KEY}`,
	{
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({id: uuid}),
	}
)
.then(fetchres.json);

const updateEs = uuid => Promise.all(['eu', 'us'].map(region => updateEsRegion(region, uuid)));

const fetchAsset = uuid => nodeFetch(`https://api.ft.com/content/items/v1/${uuid}?apiKey=${process.env.API_V1_KEY}`)
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
