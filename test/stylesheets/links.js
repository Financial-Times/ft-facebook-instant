'use strict';

const expect = require('../../test-utils/expect');
const xslt = require('../../build/lib/xslt');

describe('link transform', () => {
	const transform = input => xslt(input, `${process.cwd()}/server/stylesheets/main.xsl`);

	it('should only preserve href on a', () =>
		expect(transform('<a href="foo" bar="baz">quux</a>'))
		.dom.to.eventually.equal('<a href="foo">quux</a>')
	);

	it('should rewrite content links to ft.com', () =>
		expect(transform('<a href="/content/foo">quux</a>'))
		.dom.to.eventually.equal('<a href="http://www.ft.com/content/foo">quux</a>')
	);
});
