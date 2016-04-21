'use strict';

const articlesToLinks = require('./articlesToLinks');

module.exports = article => articlesToLinks(article.storyPackage);
