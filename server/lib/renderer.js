/**
 * © The Financial Times Limited [All rights reserved]
 */

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

module.exports.outputPage = (data, response) => module.exports.renderTemplate('page', data)
	.then(html => {
		response.setHeader('Content-Type', 'text/html; charset=utf-8');
		response.write(html);
		response.end();
	});

module.exports.outputError = (error, response) => {
	response.setHeader('Content-Type', 'text/html; charset=utf-8');
	response.statusCode = 500;
	response.write(`A script error stopped execution!<br /><pre>${error.stack || error.message || error}</pre>`);
	console.log(error);
	response.end();
};
