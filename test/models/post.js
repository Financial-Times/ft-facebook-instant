'use strict';

const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = require('../../test-utils/expect');

const redisStubs = {redis: require('fakeredis')};
const transform = sinon.stub();
const postModelStubs = {'../lib/transform': transform};
process.env.REDIS_URL = 'http://unused:1337';


const fakeRedisClient = proxyquire('../../build/lib/redisClient', redisStubs);
const fbApi = require('../../build/lib/fbApi');
const database = require('../../build/lib/database');
const articleModel = require('../../build/models/article');
const mode = require('../../build/lib/mode');

const postModel = proxyquire('../../build/models/post', postModelStubs);

const snakePeople = {
	title: 'Why snake people go on holiday instead of saving for a pension',
	canonical: 'http://www.ft.com/cms/s/2/94e97eee-ce9a-11e5-831d-09f7778e7377',
	uuid: '94e97eee-ce9a-11e5-831d-09f7778e7377',
};

describe('Post model', () => {
	after(async function test() {
		await fakeRedisClient.flushdbAsync();
	});

	describe('get', () => {
		const stubs = [];
		const since = 14e11;

		before(() => {
			stubs.push.apply(stubs, [
				sinon.stub(fbApi, 'posts'),
				sinon.stub(database, 'getLastABCheck'),
				sinon.stub(database, 'setLastABCheck'),
				sinon.stub(database, 'getCanonical'),
				sinon.stub(articleModel, 'get'),
			]);

			fbApi.posts.returns([]);
			database.getCanonical.returns(Promise.resolve(true));
		});

		beforeEach(() => {
			stubs.forEach(stub => stub.reset());
		});

		after(() => {
			stubs.forEach(stub => stub.restore());
		});

		it('should get posts since timestamp', async function test() {
			database.getLastABCheck.returns(since);

			await postModel.get();
			expect(fbApi.posts).to.have.been.calledWithMatch({since});
		});

		it('shouldn\'t get posts if it\'s never been called before', async function test() {
			database.getLastABCheck.returns(0);

			await postModel.get();
			expect(fbApi.posts).not.to.have.been.called();
		});

		it('should return empty if it\'s never been called before', async function test() {
			database.getLastABCheck.returns(0);

			expect(await postModel.get()).to.be.empty();
		});

		it('should set last ab run flag to current date', async function test() {
			database.getLastABCheck.returns(since);

			await postModel.get();
			expect(database.setLastABCheck).to.have.been.called();
			expect(database.setLastABCheck.lastCall.args[0]).to.be.above(since);
		});

		it('should get canonical urls for returned links', async function test() {
			database.getLastABCheck.returns(since);
			fbApi.posts.returns([
				'http://on.ft.com/test1',
				'http://on.ft.com/test2',
			]);

			await postModel.get();
			expect(database.getCanonical).to.have.been.calledWith('http://on.ft.com/test1');
			expect(database.getCanonical).to.have.been.calledWith('http://on.ft.com/test2');
		});

		it('should return article details for post canonicals', async function test() {
			database.getLastABCheck.returns(since);
			fbApi.posts.returns([
				'http://on.ft.com/test',
			]);
			database.getCanonical
				.withArgs('http://on.ft.com/test')
				.returns(Promise.resolve(snakePeople.canonical));
			articleModel.get
				.withArgs(snakePeople.canonical)
				.returns(Promise.resolve(snakePeople));

			expect(await postModel.get()).to.deep.equal([snakePeople]);
		});
	});

	describe('markDuplicates', () => {
		const stubs = [];

		before(() => {
			stubs.push.apply(stubs, [
			]);
		});

		beforeEach(() => {
			stubs.forEach(stub => stub.reset());
		});

		after(() => {
			stubs.forEach(stub => stub.restore());
		});

		xit('should', async function test() {});
	});

	describe('partitionRenderable', () => {
		const broken = {};
		const snakePeopleClone = Object.assign({}, snakePeople);

		afterEach(() => {
			transform.reset();
		});

		it('should split transformable and untransformable posts', async function test() {
			transform.withArgs(snakePeopleClone).returns(Promise.resolve());
			transform.withArgs(broken).returns(Promise.reject());

			const [transformable, untransformable] = await postModel.partitionRenderable([snakePeopleClone, broken]);
			expect(transformable).to.deep.equal([snakePeopleClone]);
			expect(untransformable).to.deep.equal([broken]);
		});

		it('should save transform result to rendered on transformables', async function test() {
			const rendered = {html: '', warnings: {}};
			transform.withArgs(snakePeopleClone).returns(Promise.resolve(rendered));

			await postModel.partitionRenderable([snakePeopleClone, broken]);
			expect(snakePeopleClone).to.have.property('rendered', rendered);
		});

		it('should save transform error to error on untransformables', async function test() {
			const error = new Error();
			transform.withArgs(broken).returns(Promise.reject(error));

			await postModel.partitionRenderable([snakePeopleClone, broken]);
			expect(broken).to.have.property('error', error);
		});
	});

	describe('bucketAndPublish', () => {
		const stubs = [];

		before(() => {
			stubs.push.apply(stubs, [
				sinon.stub(postModel, 'setWithBucket'),
				sinon.stub(articleModel, 'postAndSetStatus'),
				sinon.stub(mode, 'get'),
			]);
		});

		beforeEach(() => {
			stubs.forEach(stub => stub.reset());
		});

		after(() => {
			stubs.forEach(stub => stub.restore());
		});

		it('should set post bucket', async function test() {
			await postModel.bucketAndPublish(snakePeople);
			expect(postModel.setWithBucket).to.have.been.calledWith(snakePeople);
		});

		it('should\'t post IA if the bucket is control', async function test() {
			postModel.setWithBucket.returns('control');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.postAndSetStatus).not.to.have.been.called();
		});

		it('should post IA if the bucket is test', async function test() {
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.postAndSetStatus).to.have.been.calledWithMatch({
				article: snakePeople,
				username: 'daemon',
				type: 'ab',
				wait: true,
			});
		});

		it('should post IA if the bucket is test', async function test() {
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.postAndSetStatus).to.have.been.calledWithMatch({
				article: snakePeople,
				username: 'daemon',
				type: 'ab',
				wait: true,
			});
		});

		it('should publish if mode is production', async function test() {
			mode.get.returns('production');
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.postAndSetStatus).to.have.been.calledWithMatch({
				published: true,
			});
		});

		it('should not publish if mode is development', async function test() {
			mode.get.returns('development');
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.postAndSetStatus).to.have.been.calledWithMatch({
				published: false,
			});
		});
	});

	describe('getBuckets', () => {
		before(() => {
			sinon.stub(database, 'getFBLinkPosts');
		});

		after(() => {
			database.getFBLinkPosts.restore();
		});

		it('should return known posts without removed', async function test() {
			database.getFBLinkPosts.returns(Promise.resolve([
				snakePeople,
				{bucket: 'removed'},
			]));

			expect(await postModel.getBuckets()).to.deep.equal([snakePeople]);
		});
	});

	describe('setWithBucket', () => {
		it('should save post to database', async function test() {
			await postModel.setWithBucket(snakePeople);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.deep.equal(snakePeople);
		});

		it('should set bucket to random value', async function test() {
			await postModel.setWithBucket(snakePeople);
			expect(await database.getFBLinkPost(snakePeople.canonical)).property('bucket').to.be.oneOf(['test', 'control']);
		});

		it('should set bucket to test when second arg is true', async function test() {
			await postModel.setWithBucket(snakePeople, true);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.have.property('bucket', 'test');
		});

		it('should set bucket to control when second arg is false', async function test() {
			await postModel.setWithBucket(snakePeople, false);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.have.property('bucket', 'control');
		});

		it('should return set bucket', async function test() {
			expect(await postModel.setWithBucket(snakePeople, true)).to.equal('test');
		});
	});

	describe('markRemoved', () => {
		before(async function before() {
			await database.setFBLinkPost(snakePeople.canonical, snakePeople);
		});

		it('should replace post record with removed flag', async function test() {
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.deep.equal(snakePeople);
			await postModel.markRemoved(snakePeople.canonical);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.deep.equal({bucket: 'removed'});
		});
	});
});
