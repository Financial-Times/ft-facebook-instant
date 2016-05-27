'use strict';

const database = require('../lib/database');
const fbApi = require('../lib/fbApi');
const ftApi = require('../lib/ftApi');
const s3 = require('../lib/s3');
const accessTokens = require('../lib/accessTokens');
const moment = require('moment');
const insights = require('../lib/insights');

const clearCookies = (req, res) => Object.keys(req.cookies)
.filter(name => (name.indexOf('s3o') === -1)) // Don't clear S3O cookies!
.map(name => {
	res.clearCookie(name, {
		domain: '.ft.com',
	});
	return name;
});

module.exports = (req, res, next) => {
	switch(req.params.action) {
		case 'wipe':
			return Promise.all([
				fbApi.wipe(),
				database.wipe(),
			])
			.then(([fb, db]) => res.json({message: 'All wiped', fb, db}));
		case 'wipedb':
			return database.wipe()
				.then(result => res.json({message: 'Database wiped', result}));
		case 'wipefb':
			return fbApi.wipe()
				.then(result => res.json({message: 'Facebook wiped', result}));
		case 'listdb':
			return database.list()
				.then(result => res.json(result))
				.catch(next);
		case 'listfb':
			return fbApi.list({fields: ['canonical_url'], __limit: 0})
				.then(result => res.json(result))
				.catch(next);
		case 'findfb':
			return fbApi.find({canonical: 'http://www.ft.com/cms/s/2/94e97eee-ce9a-11e5-831d-09f7778e7377.html'})
				.then(result => res.json(result))
				.catch(next);
		case 'introspectimport':
			return fbApi.introspect({id: 263911067276234})
				.then(result => res.json(result))
				.catch(next);
		case 'introspectarticle':
			return fbApi.introspect({id: 1570385226586485})
				.then(result => res.json(result))
				.catch(next);
		case 'postfb':
			return fbApi.post({uuid: 'uuid - blah', html: 'blah'})
				.then(result => res.json(result))
				.catch(next);
		case 'importstatus':
			return fbApi.get({type: 'import', id: 263911067276234})
				.then(result => res.json(result))
				.catch(next);
		case 'article':
			return fbApi.get({type: 'article', id: 1570385226586485})
				.then(result => res.json(result))
				.catch(next);
		case 'deletefb':
			return fbApi.delete({canonical: 'http://www.ft.com/cms/s/2/94e97eee-ce9a-11e5-831d-09f7778e7377.html'})
				.then(result => res.json(result))
				.catch(next);
		case 'fbposts':
			return fbApi.call('/8860325749/posts', {__limit: 500})
				.then(result => res.json(result))
				.catch(next);
		case 'fetchByCanonical':
			return ftApi.fetchByCanonical('http://blogs.ft.com/tech-blog/2016/02/techft-from-phones-to-drones-at-mwc/')
				.then(result => res.json(result))
				.catch(next);
		case 'getCanonicalFromUuid':
			return ftApi.getCanonicalFromUuid('2f1774f4-ab65-11e3-aad9-00144feab7de')
				.then(result => res.json(result))
				.catch(next);
		case 'apiFetch':
			return ftApi.fetchByUuid('3ee29f96-88e0-11e3-bb5f-00144feab7de')
				.then(result => res.json(result))
				.catch(next);
		case 'clearCookies':
			return res.render('cookies', {
				cookies: JSON.stringify({cleared: clearCookies(req, res)}, undefined, '\t'),
			});
		case 'showCookies':
			return res.render('cookies', {
				cookies: JSON.stringify({cookies: req.cookies}, undefined, '\t'),
			});
		case 'throw':
			throw new Error('lol');
		case 'nexterror':
			return next(new Error('lol'));
		case 'authfb':
			return res.render('authfb', {fbAppId: process.env.FB_APP_ID});
		case 'pagetoken':
			return fbApi.call('oauth/access_token', {
				grant_type: 'fb_exchange_token',
				fb_exchange_token: req.query.accessToken,
				client_id: process.env.FB_APP_ID,
				client_secret: process.env.FB_APP_SECRET,
			}).then(({access_token: bearerToken}) => Promise.all([
				fbApi.call('me/accounts', {access_token: bearerToken}),
				fbApi.call('me', {access_token: bearerToken}),
			]))
			.then(([{data: pageData}, user]) => {
				const page = pageData.filter(({id}) => id === process.env.FB_PAGE_ID)[0];
				if(!page) {
					throw new Error('user does not have access to facebook page');
				}
				return accessTokens.add(user.id, page.access_token);
			})
			.then(() => {
				res.send('added access token');
			}).catch(next);
		case 'tokencount':
			return accessTokens.count()
				.then(count => res.json({count}));
		case 'purgeCanonical':
			return database.purgeCanonical('http://www.ft.com/cms/s/2/440824a6-bd30-11e5-9fdb-87b8d15baec2.html')
				.then(result => res.json({result}));
		case 'setInsight':
			return database.setInsight(1462802400000, {a: '123'})
				.then(result => res.json({result}));
		case 'getLastInsight':
			return database.getLastInsight()
				.then(result => res.json({result}));
		case 'wipeInsights':
			return database.wipeInsights()
				.then(result => res.json({result}));
		case 'uploadS3':
			return s3.upload('./george-test-123.txt', 'george-test-123.txt')
				.then(result => res.json({result}))
				.catch(next);
		case 'downloadS3':
			return s3.download('facebookinstantinsights-14954213-20160526080000.txt', './s3-download.csv')
				.then(result => res.json({result}))
				.catch(next);
		case 'listS3':
			return s3.list()
				.then(result => res.json({result}))
				.catch(next);
		case 'insights':
			return insights.fetch({
				since: moment.utc().startOf('hour').subtract(2, 'day'),
			})
			.then(() => {
				res.send('done');
			})
			.catch(next);
		default:
			res.sendStatus(404);
			break;
	}
};
