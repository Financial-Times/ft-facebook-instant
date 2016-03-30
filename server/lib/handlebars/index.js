'use strict';

const expressHandlebars = require('express-handlebars');
const helpers = require('./helpers');
const path = require('path');

const templateOptions = {
	cache: false,
	precompiled: true,
};

const handlebars = expressHandlebars.create({
	extname: '.html',
	layoutsDir: path.resolve(process.cwd(), 'views/layouts/'),
	partialsDir: path.resolve(process.cwd(), 'views/partials/'),
	defaultLayout: 'page',
	helpers,
});

// Middleware to expose the app's shared templates to the cliet-side of the app
// for pages which need them.
const exposeTemplates = (req, res, next) => Promise.all([
	// handlebars.getTemplates(
	// 	path.resolve(process.cwd(), 'views/templates'),
	// 	templateOptions
	// ),
	handlebars.getTemplates(
		path.resolve(process.cwd(), 'views/partials/'),
		templateOptions
	),
])
.then(compiled => {
	// const [templates, partials] = compiled;
	// return Object.assign({}, templates, partials);
	const [partials] = compiled;
	return Object.assign({}, partials);
})
.then(templates => {
	const extensionRegex = new RegExp(`${handlebars.extname}$`);

	res.locals.templates = Object.keys(templates)
		.map(name => ({
			name: name.replace(extensionRegex, ''),
			template: `Handlebars.template(${templates[name]});`,
		}));

	res.locals.helpers = Object.keys(helpers)
		.map(name => `Handlebars.registerHelper('${name}', ${helpers[name]})`);

	next();
})
.catch(next);

module.exports = app => {
	templateOptions.cache = app.enabled('view cache');
	app.set('views', path.resolve(process.cwd(), 'views/templates/'));
	app.engine('html', handlebars.engine);
	app.set('view engine', 'html');
};

module.exports.exposeTemplates = exposeTemplates;

module.exports.render = (filePath, context, options) => handlebars.render(filePath, context, options);
