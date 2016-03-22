'use strict';

const testuuids = [
	{uuid: '38587178-9824-11e5-95c7-d47aa298f769', description: 'George: TODO'},
];

module.exports = (req, res, next) => Promise.resolve()
.then(() => res.render('index', {
	IS_DEV: (process.env.NODE_ENV === 'development'),
	testuuids,
	uuid: req.params.uuid,
}))
.catch(next);
