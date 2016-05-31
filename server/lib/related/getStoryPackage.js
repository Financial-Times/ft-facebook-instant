'use strict';

const getStoryPackage = article => article.storyPackage.map(item => item.id);

module.exports = getStoryPackage;
