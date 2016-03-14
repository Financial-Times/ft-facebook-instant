'use strict';

const uuidMatch = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';

module.exports = new RegExp(uuidMatch);
module.exports.raw = uuidMatch;
