'use strict';

const renderer = require('../lib/renderer');

module.exports = (req, res) => renderer.renderTemplate('index-form')
	.then(formHTML => renderer.outputPage({body: formHTML}, res))
	.catch(err => renderer.outputError(err, res));
