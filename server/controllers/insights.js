'use strict';

module.exports = (req, res, next) => Promise.resolve()
.then(() => res.json({blah: 123}))
.catch(next);
