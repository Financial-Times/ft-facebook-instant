'use strict';

const expressHandlebars = require('express-handlebars');
const swag = require('swag');
const path = require('path');

let templateOptions = {
	cache: false,
	precompiled: true,
};

const handlebarsHelper = expressHandlebars.create({
	extname: '.html',
	layoutsDir: path.resolve(process.cwd(), 'views/layouts/'),
	partialsDir: path.resolve(process.cwd(), 'views/partials/'),
	defaultLayout: 'page',
});

// Middleware to expose the app's shared templates to the cliet-side of the app
// for pages which need them.
const exposeTemplates = (req, res, next) => Promise.all([
	handlebarsHelper.getTemplates(
		path.resolve(process.cwd(), 'views/templates'),
		templateOptions
	),
	handlebarsHelper.getTemplates(
		path.resolve(process.cwd(), 'views/partials/'),
		templateOptions
	),
])
.then(compiled => {
	const [templates, partials] = compiled;
	const all = Object.assign({}, templates, partials);
	const extensionRegex = new RegExp(`${handlebarsHelper.extname}$`);

	res.locals.templates = Object.keys(all)
		.map(name => ({
			name: name.replace(extensionRegex, ''),
			template: `Handlebars.template(${all[name]});`,
		}));

	next();
})
.catch(next);

module.exports = app => {
	templateOptions.cache = app.enabled('view cache');
	app.set('views', path.resolve(process.cwd(), 'views/templates/'));
	app.engine('html', handlebarsHelper.engine);
	app.set('view engine', 'html');
	swag.registerHelpers(handlebarsHelper.handlebars);
};

module.exports.exposeTemplates = exposeTemplates;
