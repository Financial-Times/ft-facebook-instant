'use strict';

const renderer = require('../lib/renderer');

const testuuids = [
	{uuid: '38587178-9824-11e5-95c7-d47aa298f769', description: 'George: TODO'},
];

module.exports = (req, res) => renderer.renderTemplate('index-form', {
	IS_DEV: (process.env.NODE_ENV === 'development'),
	testuuids,
	uuid: req.params.uuid,
})
.then(formHTML => renderer.outputPage({body: formHTML}, res))
.catch(err => renderer.outputError(err, res));
