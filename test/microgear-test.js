import chai from 'chai';
import MicroGear from '../lib';
chai.should();

const APPID  = '<APPID>';
const KEY    = '<APPKEY>';
const SECRET = '<APPSECRET>';

var microgear = MicroGear.create({
    key : KEY,
    secret : SECRET
});

describe('microgear-nodejs', function() {
  it('first test');
});