/**
 * NetPIE microgear Library for Node.js
 * http://netpie.io
*/

import events from 'events';
import OAuth from 'oauth';
import crypto from 'crypto';
import path from 'path';
import mqtt from 'mqtt';
import fs from 'fs';
import https from 'https';
import http from 'http';
import url from 'url';

/**
 * General API Endpoint
 */
const GEARAPIADDRESS = 'ga.netpie.io';
const GEARAPIPORT = '8080';
const GEARAPISECUREPORT = '8081';
const GBPORT = '1883';
const GBSPORT = '8883';

/**
 * Microgear API version
 */
const MGREV = 'NJS1b';

/**
 * Constants
 */
const DEBUGMODE = false;
const MINTOKDELAYTIME = 100;
const MAXTOKDELAYTIME = 30000;
const RETRYCONNECTIONINTERVAL = 5000;

let topModule = module;
while (topModule.parent) {
  topModule = topModule.parent;
}

const appdir = path.dirname(topModule.filename);
const ps = { p: 'online', a: 'offline', n: 'aliased', u: 'unaliased' };

class Microgear extends events {
  constructor(param = { key: '', secret: '', alias: '', appid: '' }) {
    super();
    const gearkey = param.key || param.gearkey || '';
    const gearsecret = param.secret || param.gearsecret || '';
    const gearalias = param.alias || param.gearalias || '';
    const appid = param.appid || param.id || null;

    this.securemode = false;
    this.debugmode = DEBUGMODE;
    this.gearkey = gearkey;
    this.gearsecret = gearsecret;
    this.gearalias = gearalias ? gearalias.substring(0, 16) : null;
    this.appid = appid;
    this.gearname = null;
    this.accesstoken = null;
    this.requesttoken = null;
    this.client = null;
    this.scope = '';
    this.gearexaddress = null;
    this.gearexport = null;
    this.subscriptions = [];
    this.options = {};
    this.toktime = MINTOKDELAYTIME;
    this.microgearcache = `microgear-${this.gearkey}.cache`;
    this.cache = {
      getItem: (key) => {
        try {
          let val = fs.readFileSync(`${appdir}/${key}`);
          if (typeof (val) != 'undefined') {
            let jsonobj;
            try {
              jsonobj = JSON.parse(val);
            }
            catch (e) {
              return null;
            }
            return jsonobj._;
          }
          else return null;
        }
        catch (e) {
          return null;
        }
      },
      setItem: (key, val) => {
        fs.writeFileSync(`${appdir}/${key}`, JSON.stringify({ _: val }));
      }
    };

    process.on('uncaughtException', (err) => {
      if (this.debugmode) {
        console.log(err.toString());
      }
    });

    this.on('newListener', (event, listener) => {
      switch (event) {
        case 'present':
          if (this.client) {
            if (this.client.connected) {
              this.subscribe('/&present');
            }
          }
          break;
        case 'absent':
          if (this.client) {
            if (this.client.connected) {
              this.subscribe('/&absent');
            }
          }
          break;
      }
    });
  }

  /**
   * Override cache file path
   * @param  {string} path cache file path
   */
  setCachePath(path) {
    this.microgearcache = path;
  }

  /**
   * Override cache file path
   * @param  {string} path cache file path
   */
  useTLS(usetls) {
    this.securemode = usetls;
  }

  /**
   * Cache getter
   * @param  {string} key key name
   * @return {String}     value
   */
  getGearCacheValue(key) {
    let c = this.cache.getItem(this.microgearcache);
    if (c == null) {
      return null;
    }

    return c[key];
  }

  /**
   * Cache setter
   * @param {String} key   key name
   * @param {String} value value
   */
  setGearCacheValue(key, value) {
    let c = this.cache.getItem(this.microgearcache);
    if (c == null) {
      c = {};
    }
    c[key] = value;
    this.cache.setItem(this.microgearcache, c);
  }

  /**
   * Clear cache
   * @param {String} key   key name
   */
  clearGearCache(key) {
    let c = this.cache.getItem(this.microgearcache);
    if (c == null) {
      return;
    }

    if (key) {
      c[key] = null;
      this.cache.setItem(this.microgearcache, c);
    } else {
      this.cache.setItem(this.microgearcache, null);
    }
  }

  /**
   * Helper function to obtain access token
   * @param  {Function} callback Callback
   */
  gettoken(callback) {
    const httpclient = this.securemode ? https : http;

    if (this.debugmode) {
      console.log('Check stored token');
    }

    const cachekey = this.getGearCacheValue('key');
    if (cachekey && cachekey != this.gearkey) {
      this.resettoken();
      this.clearGearCache();
    }

    this.setGearCacheValue('key', this.gearkey);

    if (!this.accesstoken) {
      this.accesstoken = this.getGearCacheValue('accesstoken');
    }

    if (this.accesstoken) {
      if (this.accesstoken.endpoint != "") {
        const endpoint = url.parse(this.accesstoken.endpoint);
        this.gearexaddress = endpoint.hostname;
        this.gearexport = endpoint.port;
        if (typeof (callback) == 'function') callback(3);
      } else {
        let opt;
        if (this.securemode) {
          opt = {
            host: GEARAPIADDRESS,
            path: `/api/endpoint/${this.gearkey}`,
            port: GEARAPISECUREPORT,
            method: 'GET'
          };
        }
        else {
          opt = {
            host: GEARAPIADDRESS,
            path: `/api/endpoint/${this.gearkey}`,
            port: GEARAPIPORT,
            method: 'GET'
          };
        }
        const rq = httpclient.request(opt, (res) => {
          let buff = '';
          res.on('data', (chunk) => {
            buff += chunk;
          });
          res.on('end', () => {
            if (buff) {
              self.accesstoken.endpoint = buff;
              self.setGearCacheValue('accesstoken', self.accesstoken);
              if (typeof (callback) == 'function') {
                callback(3);
              }
            }
            if (typeof (callback) == 'function') {
              callback(2);
            }
          });
        });
        rq.on('error', function (e) {
          if (typeof (callback) == 'function') {
            callback(2);
          }
        });
        rq.end();
      }
    } else {
      if (!this.requesttoken) {
        this.requesttoken = this.getGearCacheValue('requesttoken');
      }

      if (this.requesttoken) {
        /* send requesttoken to obtain accesstoken*/

        if (self.debugmode) {
          console.log('already has request token');
          console.dir(this.requesttoken);
          console.log('Requesting an access token.');
        }

        const oauthurl = this.securemode ? `https://${GEARAPIADDRESS}:${GEARAPISECUREPORT}/api/atoken` :
          `http://${GEARAPIADDRESS}:${GEARAPIPORT}/api/atoken`;

        const oauth = new OAuth.OAuth(
          null,
          oauthurl,
          this.gearkey,
          this.gearsecret,
          '1.0',
          '',
          'HMAC-SHA1'
        );

        oauth.getOAuthAccessToken(this.requesttoken.token, this.requesttoken.secret, this.requesttoken.verifier, (err, oauth_token, oauth_token_secret, results) => {
          if (!err) {
            const hkey = `${oauth_token_secret}&${this.gearsecret}`;
            const revokecode = crypto.createHmac('sha1', hkey).update(oauth_token).digest('base64').replace(/\//g, '_');
            this.accesstoken = { token: oauth_token, secret: oauth_token_secret, appkey: results.appkey, endpoint: results.endpoint, revokecode: revokecode };
            if (results.flag != 'S') {
              this.setGearCacheValue('accesstoken', this.accesstoken);
              this.setGearCacheValue('requesttoken', null);
            }
            else {
              this.clearGearCache();
            }
            if (typeof (callback) == 'function') {
              callback(2);
            }
          } else {
            switch (err.statusCode) {
              case 401:   // not authorized yet
                if (typeof (callback) == 'function') callback(1);
                break;
              case 500:   // eg. 500 request token not found
              default:
                self.emit('rejected', 'Request token rejected');
                if (typeof (callback) == 'function') callback(1);
                break;
            }
          }
        });
      } else {
        if (this.debugmode) {
          console.log("Requesting a request token.");
        }

        const verifier = this.gearalias ? this.gearalias : MGREV;

        if (!this.scope) {
          this.scope = '';
        }

        const oauthurl = this.securemode ? `https://${GEARAPIADDRESS}:${GEARAPISECUREPORT}/api/rtoken` :
          `http://${GEARAPIADDRESS}:${GEARAPIPORT}/api/rtoken`;

        const oauth = new OAuth.OAuth(
          oauthurl,
          null,
          this.gearkey,
          this.gearsecret,
          '1.0',
          `scope=${this.scope}&appid=${this.appid}&mgrev=${MGREV}&verifier=${verifier}`,
          'HMAC-SHA1'
        );

        oauth.getOAuthRequestToken({}, (err, oauth_token, oauth_token_secret, results) => {
          if (!err) {
            this.requesttoken = { token: oauth_token, secret: oauth_token_secret, verifier: verifier };
            this.setGearCacheValue('requesttoken', this.requesttoken);
            if (typeof (callback) == 'function') {
              callback(1);
            }
          } else if (typeof (callback) == 'function') {
            callback(0)
          };
        });
      }
    }
  }

  /**
   * Authenticate with broker using a current access token
   * @param  {Function} callback Callback
   */
  brokerConnect(callback) {
    const hkey = `${this.accesstoken.secret}&${this.gearsecret}`;
    const mqttuser = `${this.gearkey}%${Math.floor(Date.now() / 1000)}`;
    const mqttpassword = crypto.createHmac('sha1', hkey).update(`${this.accesstoken.token}%${mqttuser}`).digest('base64');
    const mqttclientid = this.accesstoken.token;

    if (this.debugmode) {
      console.log(`mqttuser     : ${mqttuser}`);
      console.log(`mqttpassword : ${mqttpassword}`);
    }

    this.clientid = mqttclientid;

    if (this.securemode) {
      this.client = mqtt.connect(
        `mqtts://${this.gearexaddress}`,
        {
          port: GBSPORT,
          username: mqttuser,
          password: mqttpassword,
          clientId: mqttclientid,
          protocolVersion: 3,
          keepalive: 10,
          will: this.options ? this.options.will : {}
        }
      );
    } else {
      this.client = mqtt.connect(
        `mqtt://${this.gearexaddress}`,
        {
          port: GBPORT,
          username: mqttuser,
          password: mqttpassword,
          clientId: mqttclientid,
          protocolVersion: 3,
          keepalive: 10,
          will: this.options ? this.options.will : {}
        }
      );
    }

    if (this.client) {
      /* subscribe for control messages */
      this.client.subscribe(`/&id/${this.clientid}/#`);
      if (typeof (callback) == 'function') {
        callback(null);
      }
    } else {
      if (typeof (callback) == 'function') {
        callback('error')
      };
      return;
    }

    this.client.on('error', (err) => {
      switch (err.toString()) {
        case 'Error: Connection refused: Bad username or password': // code 4
          // token may be nolonger valid, try to request a new one
          this.emit('info', 'invalid token, requesting a new one');

          this.clearGearCache();
          this.requesttoken = null;
          this.accesstoken = null;

          this.client.end();
          setTimeout(function () {
            this.initiateConnection(() => {
              if (self.debugmode) console.log('auto reconnect');
            });
          }, RETRYCONNECTIONINTERVAL);
          break;
        case 'Error: Connection refused: Not authorized': // code 5
          this.emit('warning', 'microgear unauthorized');

          this.client.end();
          setTimeout(function () {
            this.initiateConnection(function () {
              if (this.debugmode) console.log('auto reconnect');
            });
          }, RETRYCONNECTIONINTERVAL);
          break;
      }
    });

    this.client.on('message', (topic, message) => {
      const plen = this.appid.length + 1;
      const rtop = topic.substr(plen, topic.length - plen);

      if (rtop.substr(0, 2) == '/&') {
        const p = (`${rtop.substr(1, rtop.length - 1)}/`).indexOf('/');
        const ctop = rtop.substr(2, p);

        switch (ctop) {
          case 'present':
          case 'absent':
            let pm;
            try {
              pm = JSON.parse(message.toString());
            }
            catch (e) {
              pm = message.toString();
            }
            this.emit(ctop, pm);
            break;
          case 'resetendpoint':
            if (this.accesstoken && this.accesstoken.endpoint) {
              this.accesstoken.endpoint = "";
              this.setGearCacheValue('accesstoken', this.accesstoken);
              this.emit('info', 'endpoint reset');
            }
            break;
        }
      } else if (topic.substr(0, 1) == '@') {
        switch (topic) {
          case '@info': this.emit('info', message);
            break;
          case '@error': this.emit('error', message);
            break;
        }
      } else {
        this.emit('message', topic, message);
      }
    });

    this.client.on('close', () => {
      if (this.debugmode) {
        console.log('client close')
      };
      this.emit('disconnected');
    });

    this.client.on('connect', (pack) => {
      for (let i = 0; i < this.subscriptions.length; i++) {
        if (this.debugmode) {
          console.log(`auto subscribe ${this.subscriptions[i]}`);
        }
        this.client.subscribe(this.subscriptions[i]);
      }

      if (this.listeners('present')) {
        this.client.subscribe(`/${this.appid}/&present`);
      }
      if (this.listeners('absent')) {
        this.client.subscribe(`/${this.appid}/&absent`);
      }

      // if (this.gearalias) {
      //   this.setalias(this.gearalias);
      // }

      this.emit('connected');
    });

    this.client.on('end', () => {
      this.emit('pieclosed');
      this.emit('closed');
    });
  }


  /**
   * Initalize a connection to NETPIE
   * @param  {object} callback function
   */
  initiateConnection(done) {
    this.gettoken((state) => {
      switch (state) {
        case 0:    // No token issue
          console.log('Error: request token is not issued, please check your key and secret.');
          // throw new Error('Error: request token is not issued, please check your key and secret.');
          return;
        case 1:    // Request token issued or prepare to request request token again
          setTimeout(() => {
            if (this.toktime < MAXTOKDELAYTIME) self.toktime *= 2;
            this.initiateConnection(done);
          }, this.toktime);
          return;
        case 2:    // Access token issued
          this.initiateConnection(done);
          this.toktime = 1;
          return;
        case 3:    // Has access token ready for connecting broker
          this.toktime = 1;
          this.brokerConnect(() => {
            if (typeof (done) == 'function') done();
          });
          return;
      }
    });
  }

  /**
   * Do NetPIE connection
   * @param  {String}   appid appid
   * @param  {Function} done  Callback
   */
  doConnect(arg1, arg2) {
    let done = null;
    if (typeof (arg1) == 'function') {
      done = arg1;
    } else {
      if (typeof (arg1) == 'object') {
        this.options = arg1;
        if (this.options && this.options.will && this.options.will.topic) {
          this.options.will.topic = `/${appid}${this.options.will.topic}`;
        }
      }

      if (typeof (arg2) == 'function') {
        done = arg2;
      }
    }
    this.initiateConnection(done);
  };

  /**
   * Initiate NetPIE connection
   * @param  {String}   appid appid
   * @param  {Function} done  Callback
   */
  connect(arg1, arg2) {
    this.doConnect(arg1, arg2);
  }

  /*
   * Get instance of the microgear
   * @return {Object} microgear instance
   */
  getinstance() {
    return this;
  }

  /**
   * Close connection
   * @param  {Function} done Callback
   */
  disconnect(done) {
    this.client.end();
    this.emit('disconnected');
  }

  /**
   * Subscribe topic
   * @param  {String}   topic    Topic string of the form /my/topic
   * @param  {Function} callback Callback
   */
  subscribe(topic, callback) {
    if (this.client.connected) {
      this.client.subscribe(`/${this.appid}${topic}`, (err, granted) => {
        if (granted && granted[0]) {
          if (this.subscriptions.indexOf(`/${this.appid}${topic}`)) {
            this.subscriptions.push(`/${this.appid}${topic}`);
          }
        }
        if (typeof (callback) == 'function') {
          if (err) {
            callback(0);
          } else {
            if (granted && granted[0] && (granted[0].qos == 0 || granted[0].qos == 1 || granted[0].qos == 2)) {
              callback(1);
            }
            else callback(0);
          }
        }
      });
    } else {
      this.emit('error', 'microgear is disconnected, cannot subscribe.');
    }
  }

  /**
   * Unscribe topic
   * @param  {String}   topic    Topic string
   * @param  {Function} callback Callback
   */
  unsubscribe(topic, callback) {
    if (this.debugmode) {
      console.log(this.subscriptions.indexOf(`/${this.appid}${topic}`));
      console.log(this.subscriptions);
    }

    this.client.unsubscribe(`/${this.appid}${topic}`, () => {
      this.subscriptions.splice(this.subscriptions.indexOf(`/${this.appid}${topic}`));
      if (this.debugmode) {
        console.log(this.subscriptions);
      }
      if (typeof (callback) == 'function') {
        callback();
      }
    });
  }

  /**
   * Deprecated
   * Name this instance of microgear
   * @param  {String}   gearname Gear name
   * @param  {Function} callback Callback
   */
  setname(gearname, callback) {
    if (this.gearname) {
      this.unsubscribe(`/gearname/${this.gearname}`);
    }
    this.subscribe(`/gearname/${this.gearname}`, () => {
      self.gearname = gearname;
      if (typeof (callback) == 'function') {
        callback();
      }
    });
  }

  /**
   * Set alias on this instance
   * @param  {String}   gearname Gear name
   * @param  {Function} callback Callback
   */
  setalias(newalias, callback) {
    this.publish(`/@setalias/${newalias}`, '', {}, () => {
      this.gearalias = newalias;
      if (typeof (callback) == 'function') {
        callback();
      }
    });
  }

  /**
   * Reset name of this instance
   * @param  {Function} callback Callback
   */
  unsetname(callback) {
    if (this.gearname != null) {
      this.unsubscribe(`/gearname/${this.gearname}`, () => {
        this.gearname = null;
        if (typeof (callback) == 'function') {
          callback();
        }
      });
    }
  }

  /**
   * Write data to feed
   * @param  {String} feedid FeedID
   * @param  {Object} datajson Data in a json format
   * @param  {String} apikey API Key for authorization (optional)
   */
  writefeed(feedid, datajson, apikey) {
    let cmd = `/@writefeed/${feedid}`;
    if (apikey) {
      cmd += `/${apikey}`;
    }
    if (typeof (datajson) == 'object') {
      datajson = JSON.stringify(datajson)
    };
    this.publish(cmd, datajson);
  };

  /**
   * Publish message
   * @param  {String}   topic    Topic string
   * @param  {String}   message  Message
   * @param  {Object} param Publish Parameters
   */
  publish(topic, message, param, callback) {
    let options;

    switch (typeof (param)) {
      case 'object': options = param;
        break;
      case 'boolean': options = { retain: param };
        break;
      default: options = {};
    }
    if (this.client.connected) {
      this.client.publish(`/${this.appid}${topic}`, message, options, callback);
    } else {
      this.emit('error', 'microgear is disconnected, cannot publish.');
    }
  }

  /**
   * Send message to a microgear addressed by @gearname
   * @param  {String}   gearname The name of the gear to send message to
   * @param  {String}   message  Message
   * @param  {Function} callback
   */
  chat(gearname, message, options) {
    this.publish(`/gearname/${gearname}`, message, options);
  }

  /**
   * read data from a specific postbox. data will be pushed through the topic /@readpostbox/<box>
   * @param  {String}   box The name of the postbox
   */
  readpostbox(box) {
    this.publish(`/@readpostbox/${box}`);
  }

  /**
   * put data to a specific postbox
   * @param  {String}   box The name of the postbox
   * @param  {String}   data  the text data to be stored
   */
  writepostbox(box, data) {
    this.publish(`/@writepostbox/${box}`, data);
  }

  /**
   * Revoke and remove token from cache
   * @param  {Function} callback Callabck
   */
  resettoken(callback) {
    const httpclient = this.securemode ? https : http;

    this.accesstoken = this.getGearCacheValue('accesstoken');
    if (this.accesstoken) {
      let opt;
      const revokecode = this.accesstoken.revokecode.replace(/\//g, '_');

      if (this.securemode) {
        opt = {
          host: GEARAPIADDRESS,
          path: `/api/revoke/${this.accesstoken.token}/${revokecode}`,
          port: GEARAPISECUREPORT,
          method: 'GET'
        };
      }
      else {
        opt = {
          host: GEARAPIADDRESS,
          path: `/api/revoke/${this.accesstoken.token}/${revokecode}`,
          port: GEARAPIPORT,
          method: 'GET'
        };
      }

      const rq = httpclient.request(opt, (res) => {
        let result = '';
        res.on('data', (chunk) => {
          result += chunk;
        });
        res.on('end', () => {
          if (result !== 'FAILED') {
            this.clearGearCache();
            if (typeof (callback) == 'function') {
              callback(null);
            }
          } else if (typeof (callback) == 'function') {
            callback(result)
          };
        });
      });
      rq.on('error', (e) => {
        this.emit('error', `Reset token error : ${e.message}`);
        if (typeof (callback) == 'function') {
          callback(e.message);
        }
      });
      rq.end();
    } else {
      if (typeof (callback) == 'function') {
        callback(null);
      }
    }
  }



}

export default Microgear;
