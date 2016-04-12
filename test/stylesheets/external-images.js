'use strict';

const expect = require('../../test-utils/expect');
const xslt = require('../../build/lib/xslt');

describe('external image transform', () => {
	const transform = input => xslt(input, `${process.cwd()}/server/stylesheets/main.xsl`);

	it('should transform n-content-image to figure with image', () =>
		expect(transform(`<div class="n-content-image">
			<img src="foo" width="100" height="100" />
			<figcaption>caption</figcaption>
		</figure>`)).dom.to.eventually.equal(`<figure data-feedback="fb:likes,fb:comments">
			<img src="foo" width="100" height="100" />
			<figcaption>caption</figcaption>
		</figure>`)
	);

	it('should remove attributes from figcaption', () =>
		expect(transform(`<div class="n-content-image">
			<img src="foo" width="100" height="100" />
			<figcaption foo="bar">caption</figcaption>
		</figure>`)).dom.to.eventually.equal(`<figure data-feedback="fb:likes,fb:comments">
			<img src="foo" width="100" height="100" />
			<figcaption>caption</figcaption>
		</figure>`)
	);


	it('should only preserve width, height and src on img', () =>
		expect(transform(`<div class="n-content-image">
			<img src="foo" width="100" height="100" foo="bar" />
			<figcaption>caption</figcaption>
		</figure>`)).dom.to.eventually.equal(`<figure data-feedback="fb:likes,fb:comments">
			<img src="foo" width="100" height="100" />
			<figcaption>caption</figcaption>
		</figure>`)
	);
});
