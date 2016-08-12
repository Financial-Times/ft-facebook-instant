'use strict';

const chai = require('chai');
chai.use(require('@quarterto/chai-dom-equal'));
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
chai.use(require('dirty-chai'));

module.exports = chai.expect;
