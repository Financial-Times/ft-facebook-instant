'use strict';

const moduleStubs = {redis: require('fakeredis')};
process.env.REDIS_URL = 'http://unused:1337';

const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = require('../../test-utils/expect');

const redisClient = proxyquire('../../build/lib/redisClient', moduleStubs);
const fbApi = require('../../build/lib/fbApi');
const postModel = require('../../build/models/post');
const database = require('../../build/lib/database');

describe('Post model', () => {
	describe('get', () => {
		const stubs = [];

		before(() => {
			stubs.push.apply(stubs, [
				sinon.stub(fbApi, 'posts'),
				sinon.stub(database, 'getLastABCheck'),
				sinon.stub(database, 'setLastABCheck'),
			]);

			fbApi.posts.returns([]);
		});

		beforeEach(() => {
			stubs.forEach(stub => stub.reset());
		});

		after(async function() {
			stubs.forEach(stub => stub.restore());
			await redisClient.flushdbAsync();
		});

		it('should get posts since timestamp', async function() {
			const since = 14e11;
			database.getLastABCheck.returns(since);

			await postModel.get();
			expect(fbApi.posts).to.have.been.calledWithMatch({since});
		});

		it('shouldn\'t get posts if it\'s never been called before', async function() {
			database.getLastABCheck.returns(0);

			await postModel.get();
			expect(fbApi.posts).not.to.have.been.called();
		});

		it('should set last ab run flag to current date', async function() {
			const since = 14e11;
			database.getLastABCheck.returns(since);

			await postModel.get();
			expect(database.setLastABCheck).to.have.been.called();
			expect(database.setLastABCheck.lastCall.args[0]).to.be.above(since);
		});
	});
});
