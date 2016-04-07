'use strict';

module.exports = $ => Promise.resolve()
.then(() => {
	$('twitter').each((index, el) => {
		const $twitter = $(el);
		const tweetId = $twitter.attr('data-tweet-id');

		$twitter.replaceWith($(`
<figure class="op-social">
	<iframe>
		<script>
			window.twttr = (function(d, s, id) {
				var js, fjs = d.getElementsByTagName(s)[0],
					t = window.twttr || {};
				if (d.getElementById(id)) return t;
				js = d.createElement(s);
				js.id = id;
				js.src = "https://platform.twitter.com/widgets.js";
				fjs.parentNode.insertBefore(js, fjs);

				t._e = [];
				t.ready = function(f) {
					t._e.push(f);
				};

				return t;
			}(document, "script", "twitter-wjs"));


			window.twttr.ready(function() {
				window.twttr.widgets.createTweet(
					'${tweetId}',
					document.body,
					{
						conversation: 'none'
					}
				);
			});

		</script>
	</iframe>
</figure>`));
	});
})
.then(() => $);
