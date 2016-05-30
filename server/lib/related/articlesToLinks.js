'use strict';

const checkLink = require('./checkLink');

const articlesToLinks = articles => Promise.all(
	articles.map(({id}) => checkLink(`http://www.ft.com/content/${id}`))
).then(links => links.filter(link => !!link));

module.exports = articlesToLinks;
