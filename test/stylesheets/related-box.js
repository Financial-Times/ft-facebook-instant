'use strict';

const expect = require('../../test-utils/expect');
const xslt = require('../../build/lib/xslt');

describe('related box transform', () => {
	const transform = input => xslt(input, `${process.cwd()}/server/stylesheets/main.xsl`);

	it('should transform n-content-related-box to op-related-articles', () =>
		expect(transform(`<aside class="n-content-related-box">
			<div class="n-content-related-box__title-text">title</div>
			<div class="n-content-related-box__headline">
				<a href="foo">link</a>
				</div>
			</div>
		</aside>`))
		.dom.to.eventually.equal(`<ul class="op-related-articles" title="title">
			<li><a href="foo"></a></li>
		</ul>`)
	);
});
