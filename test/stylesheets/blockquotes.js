'use strict';

const expect = require('../../test-utils/expect');
const xslt = require('../../build/lib/xslt');

describe('blockquote transform', () => {
	const transform = input => xslt(input, `${process.cwd()}/server/stylesheets/main.xsl`);

	it('should strip attributes from ordinary blockquotes', () =>
		expect(transform(`<blockquote foo="bar">
			test
		</blockquote>`)).dom.to.eventually.equal(`<blockquote>
			test
		</blockquote>`)
	);

	it('should transform blockuotes with a twitter link to a twitter tag', () =>
		expect(transform(`<blockquote>
			<a href="https://twitter.com/status/username/123"></a>
		</blockquote>`)).dom.to.eventually.equal('<twitter data-tweet-id="123" />')
	);
});
