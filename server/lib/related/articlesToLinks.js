'use strict';

const checkLinks = require('./checkLinks');

const articlesToLinks = articles => checkLinks(articles.map(id => `http://www.ft.com/content/${id}`))
.then(links => links.filter(link => !!link));

module.exports = articlesToLinks;
