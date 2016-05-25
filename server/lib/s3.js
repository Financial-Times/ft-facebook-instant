'use strict';

const knox = require('knox');
const denodeify = require('denodeify');

const client = knox.createClient({
	key: process.env.S3_ACCESS_KEY_ID,
	secret: process.env.S3_SECRET_ACCESS_KEY,
	bucket: process.env.S3_BUCKET,
	region: process.env.S3_REGION,
});

module.exports.upload = (localPath, remoteFilename) => new Promise((resolve, reject) => {
	console.log(`${Date()}: S3_UPLOAD: Uploading file from ${localPath} to Amazon S3 at ` +
		`${process.env.S3_BUCKET}/${process.env.S3_REMOTE_PATH}/${remoteFilename}`);

	const remotePath = `${process.env.S3_REMOTE_PATH}/${remoteFilename}`;
	const proc = client.putFile(localPath, remotePath, (err, res) => {
		if(err) {
			return reject(err);
		}

		if(res.statusCode !== 200) {
			console.error(`${Date()}: S3_UPLOAD: Upload failed with status ${res.statusCode}`);
			console.error(res);
			return reject(Error(`S3_UPLOAD: Upload failed with status ${res.statusCode}`));
		}

		console.log(`${Date()}: S3_UPLOAD: Upload complete`);
		resolve();
	});

	let lastPercent = 0;
	proc.on('progress', ({written, total, percent}) => {
		percent = Math.floor(percent / 10) * 10;
		if(percent === 100) {
			console.log(`${Date()}: S3_UPLOAD: Upload progress: 100%. Waiting for confirmation of succesful upload.`);
		} else if(percent > lastPercent) {
			console.log(`${Date()}: S3_UPLOAD: Upload progress: ${percent}%`);
			lastPercent = percent;
		}
	});
});

module.exports.list = () => new Promise((resolve, reject) => {
	console.log(`${Date()}: S3_LIST: Listing files at ` +
		`${process.env.S3_BUCKET}/${process.env.S3_REMOTE_PATH}/`);

	client.list({
		prefix: process.env.S3_REMOTE_PATH,
	}, (err, data) => {
		if(err) {
			return reject(err);
		}

		if(data.Code || data.Message) {
			console.error(`${Date()}: S3_LIST: List failed with code ${data.Code} and message ${data.Message}`);
			console.error(data);
			return reject(Error(`S3_LIST: List failed with code ${data.Code} and message ${data.Message}`));
		}

		console.log(`${Date()}: S3_LIST: Found files: ${JSON.stringify(data)}`);
		resolve(data);
	});
});
