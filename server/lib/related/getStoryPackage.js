'use strict';

const articlesToLinks = require('./articlesToLinks');

const getStoryPackage = article => articlesToLinks(article.storyPackage);

module.exports = getStoryPackage;
