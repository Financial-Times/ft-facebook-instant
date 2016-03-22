'use strict';

const expressHandlebars = require('express-handlebars');
const swag = require('swag');
const path = require('path');

module.exports = app => {
	const handlebarsHelper = expressHandlebars.create({
		extname: '.html',
		layoutsDir: path.resolve(process.cwd(), 'views/layouts/'),
		partialsDir: path.resolve(process.cwd(), 'views/partials/'),
		defaultLayout: 'page',
	});
	app.engine('html', handlebarsHelper.engine);
	app.set('view engine', 'html');
	swag.registerHelpers(handlebarsHelper.handlebars);

	// Middleware to expose the app's shared templates to the cliet-side of the app
	// for pages which need them.
	const exposeTemplates = (req, res, next) => handlebarsHelper.getTemplates(
		path.resolve(process.cwd(), 'views/partials/'),
		{
			cache: app.enabled('view cache'),
			precompiled: true,
		}
	)
	.then(templates => {
		const extensionRegex = new RegExp(`${handlebarsHelper.extname}$`);

		res.locals.templates = Object.keys(templates)
			.map(name => ({
				name: name.replace(extensionRegex, ''),
				template: templates[name],
			}));

		next();
	})
	.catch(next);
	app.use(exposeTemplates);
};
