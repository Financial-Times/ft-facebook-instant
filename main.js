'use strict';
const express = require('express');
const ftwebservice = require('express-ftwebservice');
const authS3O = require('s3o-middleware');

const port = process.env.PORT || 6247;
const app = express();

ftwebservice(app, require('./server/controllers/ftwebservice.js'));

// Routes which don't require Staff Single Sign-On
app.get('/feed', require('./server/controllers/feed.js'));

// Routes which require Staff Single Sign-On
app.use(authS3O);
app.get('/admin', require('./server/controllers/admin.js'));



app.listen(port, () => console.log('Up and running on port', port));
