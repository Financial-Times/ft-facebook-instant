'use strict';

const spawn = require('child_process').spawn;

module.exports = (xml, stylesheet, params = {}) => new Promise((resolve, reject) => {
	const output = [];
	const errors = [];

	let options = [
		'--html',
		'--novalid',
		'--encoding', 'utf-8',
	];

	Object.keys(params).forEach(param => {
		const string = typeof params[param] === 'string';
		options = options.concat(string ? '--stringparam' : '--param', param, params[param]);
	});

	const env = {PATH: `${process.env.PATH}:${process.cwd()}/libxslt/bin`};
	const xsltproc = spawn('xsltproc', options.concat(
		stylesheet,
		'-'
	), {env});

	xsltproc.stdin.on('error', error => {
		errors.push(error.toString());
		return reject(`xsltproc stdin error: ${errors}`);
	});

	xsltproc.on('error', error => {
		console.log(error);
		errors.push(error.toString());
		return reject(`xsltproc error: ${errors}`);
	});

	xsltproc.stdout.on('data', data => {
		output.push(data);
	});

	xsltproc.stderr.on('data', error => {
		errors.push(error.toString());
	});

	xsltproc.on('close', code => {
		if(code !== 0) {
			return reject(`xsltproc exited with code ${code}: ${errors}`);
		}

		resolve(output.join('').replace(/<\/?html>/g, ''));
	});

	xsltproc.stdin.write(xml);
	xsltproc.stdin.end();
});
