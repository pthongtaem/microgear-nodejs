#!/usr/bin/env node

var MicroGear = require('../../lib');

/* --- mg1 --------------------------------- */
var mg1 = new MicroGear.default({
  key: '',
  secret: '',
  alias: 'mg1',
  appid: '',
});

mg1.on('connected', function() {
  console.log('mg1 connected...');
  setInterval(function() {
    mg1.chat('mg2', 'Hello from mg1.');
  }, 5000);
});

mg1.on('message', function(topic, msg) {
  console.log('mg1 receives :' + msg);
});

mg1.connect();

/* --- mg2 --------------------------------- */
var mg2 = new MicroGear.default({
  key: '',
  secret: '',
  alias: 'mg2',
  appid: '',
});

mg2.on('connected', function() {
  console.log('mg2 connected...');
  setInterval(function() {
    mg1.chat('mg1', 'Hello from mg2.');
  }, 5000);
});

mg2.on('message', function(topic, msg) {
  console.log('mg2 receives :' + msg);
});

mg2.connect();
