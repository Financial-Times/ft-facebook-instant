'use strict';

const elasticSearchUrl = process.env.ELASTIC_SEARCH_DOMAIN;
const signedFetch = require('signed-aws-es-fetch');
const fetchres = require('fetchres');
const index = 'v3_api_v2';

module.exports = uuid => signedFetch(`https://${elasticSearchUrl}/${index}/item/${uuid}`)
	.then(fetchres.json)
	.then(json => json._source);
