'use strict';

const expect = require('@quarterto/chai');
const xslt = require('../../build/lib/xslt');

describe('big number transform', () => {
	const transform = input => xslt(input, `${process.cwd()}/server/stylesheets/main.xsl`);

	it('should transform some markup', (done) => {
		transform(`<div class="n-content-big-number">
			<span class="n-content-big-number__title"><p>10.48m</p></span>
			<span class="n-content-big-number__content">
				<p>Record number of barrels a day that oil refiners raised processing runs to last year</p>
			</span>
		</div>`)
		.then(output => expect(output).to.equal(`<aside>
			<p>10.48m</p>
			<cite><p>Record number of barrels a day that oil refiners raised processing runs to last year</p></cite>
		</aside>`)).then(() => done(), done);
	});
});
