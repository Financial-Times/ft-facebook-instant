'use strict';

const moment = require('moment');
const inspect = require('util').inspect;
const denodeify = require('denodeify');
const exec = denodeify(require('child_process').exec);
const abController = require('../build/controllers/abController');

const redis = async cmd => {
	let out = await exec(`redis-cli ${cmd}`);
	if(/ERR/i.test(out)) {
		throw Error(`Redis command \`redis-cli ${cmd}\` failed with output: ${out}`);
	}
	out = out.trim();
	console.log(`Redis command \`redis-cli ${cmd}\` output: ${out}`);
	return out;
};

const clearLinkPosts = async () => {
	const out = await redis("keys 'linkpost:*'");
	const posts = out.split('\n');

	posts.forEach(async post => {
		await redis(`del ${post}`);
	});
};

describe('AB Test', () => {
	beforeEach(async () => {
		await clearLinkPosts();
	});

	afterEach(async () => {
		await clearLinkPosts();
	});

	it('should partition and publish FB posts from the last week', async () => {
		process.env.REDIS_URL = 'http://localhost:6379';

		const lastWeek = moment().subtract(1, 'week').unix();
		await redis(`set ab:last_poll ${lastWeek}`);

		await abController.abController().catch(e => {
			console.log('Error encountered in abController(): ');
			console.log(inspect(e, {depth: null}));
			throw e;
		});
	});
});
