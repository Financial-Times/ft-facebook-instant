'use strict';

const readFile = require('denodeify')(require('fs').readFile);
const handlebars = require('handlebars');

const templateCache = {};

function getTemplate(name) {
	if(templateCache[name]) {
		return Promise.resolve(templateCache[name]);
	}

	return Promise.resolve()
		.then(() => readFile(`resources/templates/${name}.html`, 'utf8'))
		.then(handlebars.compile)
		.then(template => (templateCache[name] = template));
}

module.exports.renderTemplate = (name, data = {}) => getTemplate(name)
	.then(template => template(data));

module.exports.outputPage = (data, res) => module.exports.renderTemplate('page', data)
	.then(res.send.bind(res));

module.exports.outputError = (error, res) => {
	console.log(error);
	console.log(error.stack);

	res.statusCode = 500;
	res.send(`A script error stopped execution!<br /><pre>${error.stack || error.message || error}</pre>`);
};
