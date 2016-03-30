'use strict';


module.exports = (req, res, next) => {
	res.render('fb', {
		appId: process.env.FB_APP_ID,
	});
};
