'use strict';

const encodeId = id => {
	/* id is either a Brightcove-assigned id, or a customer-generated reference id.
		reference ids are prefixed 'ref:' and the colon must be preserved unencoded */
	if(id.substring(0, 4) === 'ref:') {
		return `ref:${encodeURIComponent(id.substring(4))}`;
	} else {
		return encodeURIComponent(id);
	}
};

const replaceHtml = ($, el) => {
	const $brightcove = $(el);

	const width = 320;
	const height = 180;
	const account = $brightcove.attr('data-account');
	const playerid = $brightcove.attr('data-player');
	const videoId = $brightcove.attr('data-video-id');
	const embed = 'default';

	const src = `https://players.brightcove.net/${encodeURIComponent(account)}/`
		+ `${encodeURIComponent(playerid)}_${encodeURIComponent(embed)}/index.html?videoId=${encodeId(videoId)}&autoplay=true`;

	$brightcove.replaceWith($(`<figure class="op-interactive"><iframe width="${width}" height="${height}" src="${src}"></iframe></figure>`));
};

module.exports = $ => Promise.resolve()
.then(() => {
	$('brightcove').map((index, el) => replaceHtml($, el));
})
.then(() => $);
