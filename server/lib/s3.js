'use strict';

const s3 = require('s3');

const client = s3.createClient({
	s3Options: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
		region: process.env.S3_REGION,
	},
});


module.exports.download = () => new Promise((resolve, reject) => {
	const proc = client.downloadFile({
		localFile: './aws-download',
		s3Params: {
			Bucket: 'dev.ft.dw.source',
			// Key: 'content/annotations-02051870-20160523115505.txt',
			Key: 'external/apps.facebook-instant.dev/george-test.txt',
		},
	});

	proc.on('error', err => {
		console.error('unable to download:', err.stack);
		reject(err);
	});

	proc.on('progress', () => {
		console.log('progress', proc.progressAmount, proc.progressTotal);
	});

	proc.on('end', () => {
		console.log('done downloading');
		resolve();
	});
});


module.exports.upload = () => new Promise((resolve, reject) => {
	const proc = client.uploadFile({
		localFile: './george-test.txt',
		s3Params: {
			Bucket: 'dev.ft.dw.source',
			Key: 'content/george-test.txt',
			// Key: 'external/apps.facebook-instant.dev/george-test.txt',
		},
	});

	proc.on('error', err => {
		console.error('unable to upload:', err.stack);
		reject(err);
	});

	proc.on('progress', () => {
		console.log('progress', proc.progressAmount, proc.progressTotal);
	});

	proc.on('end', () => {
		console.log('done uploading');
		resolve();
	});
});
