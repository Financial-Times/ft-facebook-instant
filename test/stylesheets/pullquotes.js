'use strict';

const expect = require('../../test-utils/expect');
const xslt = require('../../build/lib/xslt');

describe('pullquote transform', () => {
	const transform = input => xslt(input, `${process.cwd()}/server/stylesheets/main.xsl`);

	it('should transform n-content-pullquote to aside with cite', () =>
		expect(transform(`<div class="n-content-pullquote">
			<div class="n-content-pullquote__content">
				content
				<div class="n-content-pullquote__footer">footer</div>
			</div>
		</div>`))
		.dom.to.eventually.equal(`<aside>
			content
			<cite>footer</cite>
		</aside>`)
	);
});
