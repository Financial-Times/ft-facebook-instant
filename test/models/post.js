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
const RichError = require('../../build/lib/richError');

const postModel = proxyquire('../../build/models/post', postModelStubs);

const snakePeople = {
	title: 'Why snake people go on holiday instead of saving for a pension',
	canonical: 'http://www.ft.com/cms/s/2/94e97eee-ce9a-11e5-831d-09f7778e7377',
	uuid: '94e97eee-ce9a-11e5-831d-09f7778e7377',
};

const stubAll = createStubs => {
	const stubs = [];

	before(() => {
		stubs.push.apply(stubs, createStubs());
	});

	beforeEach(() => {
		stubs.forEach(s => s.reset());
	});

	after(() => {
		stubs.forEach(s => s.restore && s.restore());
	});
};

describe('Post model', () => {
	after(async () => {
		await fakeRedisClient.flushdbAsync();
	});

	describe('get', () => {
		const since = 14e11;

		stubAll(() => [
			sinon.stub(fbApi, 'posts').returns([]),
			sinon.stub(database, 'getLastABCheck'),
			sinon.stub(database, 'setLastABCheck'),
			sinon.stub(articleModel, 'get'),
		]);

		it('should get posts since timestamp', async () => {
			database.getLastABCheck.returns(since);

			await postModel.get();
			expect(fbApi.posts).to.have.been.calledWithMatch({since});
		});

		it('shouldn\'t get posts if it\'s never been called before', async () => {
			database.getLastABCheck.returns(0);

			await postModel.get();
			expect(fbApi.posts).not.to.have.been.called();
		});

		it('should return empty if it\'s never been called before', async () => {
			database.getLastABCheck.returns(0);

			expect(await postModel.get()).to.be.empty();
		});

		it('should set last ab run flag to current date', async () => {
			database.getLastABCheck.returns(since);

			await postModel.get();
			expect(database.setLastABCheck).to.have.been.called();
			expect(database.setLastABCheck.lastCall.args[0]).to.be.above(since);
		});

		it('should return a dummy object representing the article', async () => {
			database.getLastABCheck.returns(since);
			fbApi.posts.returns([
				'http://on.ft.com/test',
			]);

			expect(await postModel.get()).to.deep.equal([{origUrl: 'http://on.ft.com/test'}]);
		});
	});

	describe('getPostCanonical', () => {
		stubAll(() => [
			sinon.stub(database, 'getCanonical'),
		]);

		it('should get canonical urls and attach to objects', async () => {
			const post = {origUrl: 'http://on.ft.com/test'};
			const canonical = 'http://www.ft.com/cms/s/0/00000000-0000-0000-0000-000000000000.html';
			database.getCanonical
				.withArgs(post.origUrl)
				.returns(Promise.resolve(canonical));

			await postModel.getPostCanonical(post);
			expect(database.getCanonical).to.have.been.calledWith(post.origUrl);
			expect(post).to.have.property('canonical', canonical);
		});

		it('should ignore elastic search errors and return null', async () => {
			const post = {origUrl: 'http://on.ft.com/test'};
			const err = new Error();
			err.type = 'FtApiContentMissingException';
			database.getCanonical
				.withArgs(post.origUrl)
				.returns(Promise.reject(err));

			expect(await postModel.getPostCanonical(post)).to.be.null();
			expect(database.getCanonical).to.have.been.calledWith(post.origUrl);
			expect(post).not.to.have.property('canonical');
		});

		it('should pass on other classes of error', async () => {
			const post = {origUrl: 'http://on.ft.com/test'};
			const err = new Error();
			database.getCanonical
				.withArgs(post.origUrl)
				.returns(Promise.reject(err));

			await expect(postModel.getPostCanonical(post)).to.be.rejected();
			expect(database.getCanonical).to.have.been.calledWith(post.origUrl);
		});
	});

	describe('hydratePostWithArticle', () => {
		stubAll(() => [
			sinon.stub(articleModel, 'get'),
		]);

		it('should assign article details for post canonicals', async () => {
			const snakePeopleDummy = {
				canonical: snakePeople.canonical,
			};

			articleModel.get
				.withArgs(snakePeople.canonical)
				.returns(Promise.resolve(snakePeople));

			await postModel.hydratePostWithArticle(snakePeopleDummy);
			expect(snakePeopleDummy).to.deep.equal(snakePeople);
		});
	});

	describe('isDupe', () => {
		stubAll(() => [
			sinon.stub(database, 'getFBLinkPost'),
			sinon.stub(postModel, 'markRemoved'),
		]);

		it('should be false for never-seen-before posts', async () => {
			database.getFBLinkPost.returns(undefined);
			const isDupe = postModel.isDupeFactory();
			const results = await Promise.all([
				{canonical: 'test1'},
				{canonical: 'test2'},
				{canonical: 'test3'},
			].map(isDupe));

			results.forEach(result => expect(result).to.be.false());
		});

		it('should return true for already seen post and mark as removed in database', async () => {
			database.getFBLinkPost.returns(undefined);
			const isDupe = postModel.isDupeFactory(
				new Map([
					['test', {canonical: 'test'}],
				])
			);
			expect(await isDupe({canonical: 'test'})).to.be.true();
			expect(postModel.markRemoved).to.have.been.calledWith('test');
		});

		it('should return true for post already in database and mark as removed in database', async () => {
			database.getFBLinkPost.withArgs('test').returns({canonical: 'test'});
			database.getFBLinkPost.returns(undefined);

			const isDupe = postModel.isDupeFactory();
			expect(
				await isDupe({canonical: 'test'})
			).to.be.true();
			expect(postModel.markRemoved).to.have.been.calledWith('test');
		});

		it('should set status of removed posts', async () => {
			const test2 = {canonical: 'test2'};
			const test3 = {canonical: 'test3'};
			database.getFBLinkPost.withArgs('test2').returns(test2);
			database.getFBLinkPost.returns(undefined);

			const isDupe = postModel.isDupeFactory();
			await Promise.all([
				{canonical: 'test1'},
				test2,
				test3,
				test3,
			].map(isDupe));

			expect(test2).property('status').to.deep.equal({alreadyInTest: true, dupeInBatch: false});
			expect(test3).property('status').to.deep.equal({alreadyInTest: false, dupeInBatch: true});
		});
	});

	describe('canRenderPost', () => {
		let snakePeopleClone;
		let broken;

		beforeEach(() => {
			snakePeopleClone = Object.assign({}, snakePeople);
			broken = {};
			transform.reset();
		});

		it('should split transformable and untransformable posts', async () => {
			transform.withArgs(snakePeopleClone).returns(Promise.resolve());
			transform.withArgs(broken).returns(Promise.reject());

			expect(await postModel.canRenderPost(snakePeopleClone)).to.be.true();
			expect(await postModel.canRenderPost(broken)).to.be.false();
		});

		it('should save transform result to rendered on transformables', async () => {
			const rendered = {html: '', warnings: {}};
			transform.withArgs(snakePeopleClone).returns(Promise.resolve(rendered));

			await postModel.canRenderPost(snakePeopleClone);
			expect(snakePeopleClone).to.have.property('rendered', rendered);
		});

		it('should save transform error to error on untransformables', async () => {
			const error = new Error();
			transform.withArgs(broken).returns(Promise.reject(error));

			await postModel.canRenderPost(broken);
			expect(broken).to.have.property('error', error);
		});
	});

	describe('canPublishPost', () => {
		stubAll(() => [
			sinon.stub(fbApi, 'post').returns({}),
			sinon.stub(mode, 'get'),
		]);

		it('should attempt to publish the post', async () => {
			const test = {uuid: '00000000-0000-0000-0000-000000000000', rendered: {html: 'html'}};
			await postModel.canPublishPost(test);
			expect(fbApi.post).to.have.been.calledWithMatch({
				uuid: test.uuid,
				html: test.rendered.html,
			});
		});

		it('should publish if in production mode', async () => {
			mode.get.returns('production');

			const test = {uuid: '00000000-0000-0000-0000-000000000000', rendered: {html: 'html'}};
			await postModel.canPublishPost(test);
			expect(fbApi.post).to.have.been.calledWithMatch({
				published: true,
			});
		});

		it('should return true if publish succeeds and set id to post', async () => {
			const id = '123456789';
			fbApi.post.returns({id});

			const test = {uuid: '00000000-0000-0000-0000-000000000000', rendered: {html: 'html'}};
			expect(await postModel.canPublishPost(test)).to.be.true();
			expect(test).to.have.property('facebookId', id);
		});

		it('should pass on error if not from facebook', async () => {
			const test = {uuid: '00000000-0000-0000-0000-000000000000', rendered: {html: 'html'}};
			fbApi.post.throws(new Error());

			await expect(postModel.canPublishPost(test)).to.be.rejected();
		});

		it('should return false and set error property', async () => {
			const test = {uuid: '00000000-0000-0000-0000-000000000000', rendered: {html: 'html'}};
			const err = new RichError('Unexpected import status', {
				type: 'FbApiImportException',
			});
			fbApi.post.throws(err);

			expect(await postModel.canPublishPost(test)).to.be.false();
			expect(test).to.have.property('error', err);
		});
	});

	describe('partitionTestable', () => {
		const isDupe = sinon.stub();

		stubAll(() => [
			sinon.stub(postModel, 'isDupeFactory'),
			sinon.stub(postModel, 'getPostCanonical'),
			sinon.stub(postModel, 'hydratePostWithArticle'),
			sinon.stub(postModel, 'canRenderPost'),
			sinon.stub(postModel, 'canPublishPost'),
			isDupe,
		]);

		before(() => {
			postModel.isDupeFactory.returns(isDupe);
		});

		it('should remove posts that do not have a canonical url', async () => {
			const test1 = {origUrl: 'http://on.ft.com/test1'};
			const test2 = {origUrl: 'http://on.ft.com/test2'};
			const test3 = {origUrl: 'http://on.ft.com/test3'};

			isDupe.returns(false);
			postModel.canRenderPost.returns(true);
			postModel.canPublishPost.returns(true);

			postModel.getPostCanonical
				.withArgs(test1)
				.returns(Promise.resolve(Object.assign({
					canonical: 'http://www.ft.com/cms/s/0/00000000-0000-0000-0000-000000000000.html',
				}, test1)));
			postModel.getPostCanonical
				.withArgs(test2)
				.returns(Promise.resolve(Object.assign({
					canonical: 'http://www.ft.com/cms/s/0/00000000-0000-0000-0000-000000000001.html',
				}, test1)));
			postModel.getPostCanonical
				.withArgs(test3)
				.returns(Promise.resolve(null));

			const {testable, untestable} = await postModel.partitionTestable([test1, test2, test3]);
			expect(testable).to.deep.equal([test1, test2]);
			expect(untestable).to.deep.equal([test3]);
			expect(test3).to.have.property('reason', 'it\'s not an article');
		});

		it('should remove posts that are dupes', async () => {
			const test1 = {origUrl: 'http://on.ft.com/test1'};
			const test2 = {origUrl: 'http://on.ft.com/test2'};
			const test3 = {origUrl: 'http://on.ft.com/test3'};

			isDupe.returns(false);
			isDupe.withArgs(test3).returns(true);
			postModel.canRenderPost.returns(true);
			postModel.canPublishPost.returns(true);
			postModel.getPostCanonical.returnsArg(0);

			const {testable, untestable} = await postModel.partitionTestable([test1, test2, test3]);
			expect(testable).to.deep.equal([test1, test2]);
			expect(untestable).to.deep.equal([test3]);
			expect(test3).to.have.property('reason', 'we\'ve seen it already');
		});

		it('should remove posts that can\'t be rendered', async () => {
			const test1 = {origUrl: 'http://on.ft.com/test1'};
			const test2 = {origUrl: 'http://on.ft.com/test2'};
			const test3 = {origUrl: 'http://on.ft.com/test3'};

			isDupe.returns(false);
			postModel.getPostCanonical.returnsArg(0);
			postModel.canRenderPost.returns(true);
			postModel.canRenderPost
				.withArgs(test3)
				.returns(false);
			postModel.canPublishPost.returns(true);

			await postModel.partitionTestable([test1, test2, test3]);
			const {testable, untestable} = await postModel.partitionTestable([test1, test2, test3]);
			expect(testable).to.deep.equal([test1, test2]);
			expect(untestable).to.deep.equal([test3]);
			expect(test3).to.have.property('reason', 'we couldn\'t render it');
		});

		it('should remove posts that can\'t be published', async () => {
			const test1 = {origUrl: 'http://on.ft.com/test1'};
			const test2 = {origUrl: 'http://on.ft.com/test2'};
			const test3 = {origUrl: 'http://on.ft.com/test3'};

			isDupe.returns(false);
			postModel.getPostCanonical.returnsArg(0);
			postModel.canPublishPost.returns(true);
			postModel.canPublishPost
				.withArgs(test3)
				.returns(false);
			postModel.canRenderPost.returns(true);

			await postModel.partitionTestable([test1, test2, test3]);
			const {testable, untestable} = await postModel.partitionTestable([test1, test2, test3]);
			expect(testable).to.deep.equal([test1, test2]);
			expect(untestable).to.deep.equal([test3]);
			expect(test3).to.have.property('reason', 'we couldn\'t post it to facebook');
		});

		it('should hydrate posts with article details', async () => {
			const test1 = {origUrl: 'http://on.ft.com/test1'};
			const test2 = {origUrl: 'http://on.ft.com/test2'};
			const test3 = {origUrl: 'http://on.ft.com/test3'};

			isDupe.returns(false);
			postModel.canRenderPost.returns(true);
			postModel.canPublishPost.returns(true);
			postModel.getPostCanonical.returnsArg(0);

			await postModel.partitionTestable([test1, test2, test3]);
			expect(postModel.hydratePostWithArticle).to.have.been.calledThrice();
			expect(postModel.hydratePostWithArticle).to.have.been.calledWith(test1);
			expect(postModel.hydratePostWithArticle).to.have.been.calledWith(test2);
			expect(postModel.hydratePostWithArticle).to.have.been.calledWith(test3);
		});
	});

	describe('bucketAndPublish', () => {
		stubAll(() => [
			sinon.stub(postModel, 'setWithBucket'),
			sinon.stub(articleModel, 'setImportStatus'),
			sinon.stub(mode, 'get'),
		]);

		it('should set post bucket', async () => {
			await postModel.bucketAndPublish(snakePeople);
			expect(postModel.setWithBucket).to.have.been.calledWith(snakePeople);
		});

		it('should\'t post IA if the bucket is control', async () => {
			postModel.setWithBucket.returns('control');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.setImportStatus).not.to.have.been.called();
		});

		it('should post IA if the bucket is test', async () => {
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.setImportStatus).to.have.been.calledWithMatch({
				article: snakePeople,
				username: 'daemon',
				type: 'ab',
				wait: true,
			});
		});

		it('should post IA if the bucket is test', async () => {
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.setImportStatus).to.have.been.calledWithMatch({
				article: snakePeople,
				username: 'daemon',
				type: 'ab',
				wait: true,
			});
		});

		it('should publish if mode is production', async () => {
			mode.get.returns('production');
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.setImportStatus).to.have.been.calledWithMatch({
				published: true,
			});
		});

		it('should not publish if mode is development', async () => {
			mode.get.returns('development');
			postModel.setWithBucket.returns('test');
			await postModel.bucketAndPublish(snakePeople);
			expect(articleModel.setImportStatus).to.have.been.calledWithMatch({
				published: false,
			});
		});
	});

	describe('getBuckets', () => {
		stubAll(() => [
			sinon.stub(database, 'getFBLinkPosts'),
		]);

		it('should return known posts without removed', async () => {
			database.getFBLinkPosts.returns(Promise.resolve([
				snakePeople,
				{bucket: 'removed'},
			]));

			expect(await postModel.getBuckets()).to.deep.equal([snakePeople]);
		});
	});

	describe('setWithBucket', () => {
		it('should save post to database', async () => {
			await postModel.setWithBucket(snakePeople);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.deep.equal(snakePeople);
		});

		it('should set bucket to random value', async () => {
			await postModel.setWithBucket(snakePeople);
			expect(await database.getFBLinkPost(snakePeople.canonical)).property('bucket').to.be.oneOf(['test', 'control']);
		});

		it('should set bucket to test when second arg is true', async () => {
			await postModel.setWithBucket(snakePeople, true);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.have.property('bucket', 'test');
		});

		it('should set bucket to control when second arg is false', async () => {
			await postModel.setWithBucket(snakePeople, false);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.have.property('bucket', 'control');
		});

		it('should return set bucket', async () => {
			expect(await postModel.setWithBucket(snakePeople, true)).to.equal('test');
		});
	});

	describe('markRemoved', () => {
		before(async () => {
			await database.setFBLinkPost(snakePeople.canonical, snakePeople);
		});

		it('should replace post record with removed flag', async () => {
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.deep.equal(snakePeople);
			await postModel.markRemoved(snakePeople.canonical);
			expect(await database.getFBLinkPost(snakePeople.canonical)).to.deep.equal({
				bucket: 'removed',
				canonical: snakePeople.canonical,
			});
		});
	});
});
