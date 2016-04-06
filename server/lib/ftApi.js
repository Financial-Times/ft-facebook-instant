'use strict';

const nodeFetch = require('node-fetch');
const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const index = 'v3_api_v2';


const fetch = uuid => signedFetch(`https://${elasticSearchUrl}/${index}/item/${uuid}`)
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
);

const updateEs = uuid => Promise.all(['eu', 'us'].map(region => updateEsRegion(region, uuid)));

module.exports = {
	fetch,
	fetchByCanonical,
	getCanonicalFromUuid,
	verifyCanonical,
	updateEs,
};
