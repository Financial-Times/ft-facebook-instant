'use strict';

const stubs = {redis: require('fakeredis')};
process.env.REDIS_URL = 'http://unused:1337';

const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = require('../../test-utils/expect');

const redisClient = proxyquire('../../build/lib/redisClient', stubs);
const fbApi = require('../../build/lib/fbApi');
const postModel = require('../../build/models/post');
const database = require('../../build/lib/database');

describe('Post model', () => {
	describe('get', () => {
		before(() => {
			sinon.stub(fbApi, 'posts');
			sinon.stub(database, 'getLastABCheck');
		});

		after(async function() {
			fbApi.posts.restore();
			await redisClient.flushdbAsync();
		});

		it('should get posts since timestamp', async function() {
			const since = 14e11;
			fbApi.posts.returns([]);
			database.getLastABCheck.returns(since);

			await postModel.get();
			expect(fbApi.posts).to.have.been.calledWithMatch({since});
		});
	});
});
