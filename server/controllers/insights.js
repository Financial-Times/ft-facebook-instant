'use strict';

const fbApi = require('../lib/fbApi');
const pageId = process.env.FB_PAGE_ID;

const addPostDetails = posts => {
	const batch = posts.map(post => ({
		method: 'get',
		relative_url: `${post.id}?fields=link,created_time,message,id,description,is_published`,
	}));

	return fbApi.call('', 'post', {batch})
		.then(batchResults => batchResults.map((result, index) => JSON.parse(result.body)));
};

module.exports = (req, res, next) => fbApi.call(
	`/${pageId}/posts`,
	'GET',
	{
		// TODO: pagination
		limit: 10,
	}
)
.then(posts => addPostDetails(posts.data))
.then(posts => res.json(posts))
.catch(next);
