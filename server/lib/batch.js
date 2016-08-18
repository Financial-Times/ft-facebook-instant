'use strict';

module.exports = (items, batchSize, fn) => Promise.resolve(items)
.then(arr => arr
	.map((item, index) =>
		(index % batchSize ? [] : arr.slice(index, index + batchSize)))
	.map(group =>
		all =>
			Promise.all(group.map(fn))
			.then(res => all.concat(res))
	)
	.reduce(
		(chain, work) => chain.then(work),
		Promise.resolve([])
	)
);
