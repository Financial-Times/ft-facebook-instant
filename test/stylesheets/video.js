'use strict';

const expect = require('../../test-utils/expect');
const xslt = require('../../build/lib/xslt');

describe('related box transform', () => {
	const brightcoveAccountId = 'account';
	const brightcovePlayerId = 'player';
	const transform = input => xslt(input, `${process.cwd()}/server/stylesheets/main.xsl`, {
		brightcoveAccountId, brightcovePlayerId
	});

	it('should transform n-content-video--youtube to youtube custom element', () =>
		expect(transform(`<div class="n-content-video--youtube">
			<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" />
		</div>`))
		.dom.to.eventually.equal('<youtube data-video-id="dQw4w9WgXcQ" />')
	);

	it('should transform n-content-video--brightcove to brightcove custom element', () =>
		expect(transform(`<div class="n-content-video--brightcove">
			<a href="http://video.ft.com/foo">video</a>
		</div>`))
		.dom.to.eventually.equal(`<brightcove data-video-id="foo" data-player="${brightcovePlayerId}" data-account="${brightcoveAccountId}" />`)
	);
});
