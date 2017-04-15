#!/usr/bin/env node

var MicroGear = require('../../lib');

const KEY = '';
const SECRET = '';
const APPID = '';
const ALIAS = '';

var microgear = new MicroGear.default({
  key: KEY,
  secret: SECRET,
  appid: APPID,
  alias: ALIAS,
});

microgear.on('connected', function() {
  console.log('Connected...');
  microgear.setalias('mygear');
  setInterval(function() {
    microgear.chat('mygear', 'Hello world.');
  }, 1000);
});

microgear.on('message', function(topic, body) {
  console.log('incoming : ' + topic + ' : ' + body);
});

microgear.on('closed', function() {
  console.log('Closed...');
});

microgear.connect();
