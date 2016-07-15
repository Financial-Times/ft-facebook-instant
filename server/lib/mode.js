'use strict';

let mode = 'development';

module.exports.set = newMode => (mode = newMode);
module.exports.get = () => mode;
