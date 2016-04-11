'use strict';

const nodeFetch = require('node-fetch');
const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');
const uuidRegex = require('./uuid');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';


const fetch = uuid => signedFetch(`https://${elasticSearchUrl}/${index}/item/${uuid}`)
.then(fetchres.json)
.then(json => json._source);

const fetchByUuid = uuid => signedFetch(`https://${elasticSearchUrl}/${index}/item/${uuid}`)
.then(fetchres.json)
.then(json => json._source);

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

		return null;
	}
});

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
		return null;
	}
});

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
		return null;
	}
});

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
.then(fetchres.json);

module.exports = {
	fetch,
	fetchByCanonical,
	getCanonicalFromUuid,
	verifyCanonical,
	updateEs,
	fetchAsset,
};
