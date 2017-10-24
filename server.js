var fs = require('fs');
var path = require('path');
var http = require('http');
// var httpProxy = require('http-proxy');
var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var uaParser = require('ua-parser-js');
var logger = require("morgan");
var uuid = require('uuid');
// var formidable = require('formidable');
// var util = require('./lib/util');
const PUBLIC_FOLDER_PATH = path.resolve(__dirname, "public");
const HTTP_PORT        = 80;
const MAX_SDP_STORE    = 10;
const SDP_EXPIRED_TIME = 30000; // 30 secs
const sdpStore = {};

function registerSDP(req, res) {
	const parms = getReqParam(req);
	const sdbKeys = Object.keys(sdpStore);

	if (parms['sdp'] === undefined || parms['sdp'] === "") {
		return res.json({
			code: -1,
			msg: 'Please specify sdp.'
		});
	}	
	if (sdbKeys.length > MAX_SDP_STORE) {
		return res.json({
			code: -2,
			msg: 'Too much sdp store!. max sdp number = ' + MAX_SDP_STORE
		});	
	}

	const newSdpKey = uuid();	
	sdpStore[ newSdpKey ] = {
		parms: parms,
		time : Date.now()
	};

	res.json({
		code: 0,
		msg: 'Register sdp success!',
		key: newSdpKey
	});
}

function querySDP(req, res) {
	const parms = getReqParam(req);
	if (parms['key'] === undefined ) {
		return res.json({
			code: -1,
			msg: 'Please specify key.'
		});
	}		
	const userKey = parms['key'];	
	if (sdpStore[userKey] === undefined) {
		return res.json({
			code: -2,
			msg: 'Invalid key = ' + userKey
		});
	}
	
	// update time of sdp
	sdpStore[userKey].time = Date.now();	

	// reply
	const sdp_list = Object.keys(sdpStore).map(key => sdpStore[key].parms);			
	res.json({
		code     : 0,
		msg     : 'Query sdp success!',
		sdp_list: sdp_list
	});
}

function unregisterSDP(req, res) {
	const parms = getReqParam(req);	
	if (parms['key'] === undefined ) {
		return res.json({
			code: -1,
			msg: 'Please specify key.'
		});
	}		
	const userKey = parms['key'];
	if (sdpStore[userKey] !== undefined) {
		delete sdpStore[userKey];
	}	
	res.json({
		code     : 0,
		msg     : 'Unregister sdp success!'		
	});	
}

function getReqParam(req) {  
  var obj, prop, val;
  switch( req.method ) {
    case 'GET':
      obj = req.query;
    break;
    case 'POST':
      obj = req.body;
    break;
    default:
      obj = {};
  }
  for (prop in obj) {
    val = obj[prop];
    if ( val[0] && val[0] !== '0' && !isNaN( val ) ) {
      obj[prop] = +val;
    }
  }
  return obj;
}

function onRequestNotFound(req, res) {
	res.status(404).send('404 files not found.');
}

function deleteExpiredSdp() {
	// console.log(`${Date.now()}: ${JSON.stringify(sdpStore)}`);

	let curTime = Date.now();
	for (let prop in sdpStore) {
		let sdp = sdpStore[prop];
		if (curTime - sdp.time > SDP_EXPIRED_TIME) {
			delete sdpStore[prop];
		}
	}
}

(function() {
	const app = express();
	// logger
	app.use(logger('short'));

	// cookie-parser & body-parser
	app.use(cookieParser());
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({extended: false}));

  //public static files
  app.use(express.static( PUBLIC_FOLDER_PATH )); 

	// cgi
	app.all("/sdp/register", registerSDP);
	app.all("/sdp/query", querySDP);
	app.all("/sdp/unregister", unregisterSDP);

	// 404 not found
	app.use( onRequestNotFound );

	// start server
	http.createServer(app).listen(HTTP_PORT, '127.0.0.1', function(err) {
	  if(err) throw err;
	  console.log('Start listening on ' + HTTP_PORT + ' .....');
	}); 	

	setInterval(deleteExpiredSdp, 1000);
})();