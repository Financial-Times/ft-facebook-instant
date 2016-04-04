'use strict';

let mode;

module.exports.set = newMode => (mode = newMode);
module.exports.get = () => mode;
