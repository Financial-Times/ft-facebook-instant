'use strict';

const checkLink = require('./checkLink');

module.exports = articles => Promise.all(
	articles.map(({id}) => checkLink(`http://www.ft.com/content/${id}`))
).then(links => links.filter(link => !!link));
