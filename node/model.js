var firebase = require('./firebase');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');

var timestamp = 0;
var LIMIT = 2147483649;
var BUFFER_TIME = 5 * 1000;
var TICK_INTERVAL = 5 * 1000;

function initialize() {
    timestamp = (new Date()).getTime();
}
initialize();

function tick() {
    firebase.getQueue(function (queue) {
        var min = LIMIT;
        var minVideo = {};
        for (var u in queue) {
            var videoObj = queue[u];
            if (videoObj.id < min) {
                minVideo = videoObj;
                min = videoObj.id;
            }
        }

        var time = (new Date()).getTime();
        var duration = minVideo.duration * 1000;
        // exceeds time limit
        if (time > duration + timestamp + BUFFER_TIME) {
            // remove the oldest video
            firebase.popQueue(minVideo, function (error) {
                // get new timestamp
                timestamp = (new Date()).getTime();
            });
        }
    });
}

setInterval(tick, TICK_INTERVAL);

exports.localStrategy = new LocalStrategy(function(username, password, callback) {
  firebase.getUser(username, function(err, user) {
    if (user) {
      bcrypt.compare(password, user.pwHash, function(err, authenticated) {
        if (authenticated) {
          callback(null, user);
        } else {
          callback(null, false);
        }
      });
    } else {
      callback(null, false);
    }
  });
});

exports.createUser = function(username, password, passwordconfirm, callback) {
  if(/[^a-zA-Z0-9_]/.test(username)) {
    callback('Invalid characters in username');
    return;
  }
  if (password !== passwordconfirm) {
    callback('Passwords don\'t match');
    return;
  }
  firebase.getUser(username, function(err, user) {
    if (user) {
      callback('Username already exists');
    } else {
      firebase.createUser(username, bcrypt.hashSync(password, 10), function(err) {
        callback(err);
      });
    }
  });
}

exports.submitVideo = function(username, videoName, linkName, callback) {
  firebase.submitVideo(username, videoName, linkName, function(err, user) {
    callback(false);
  });
}

exports.findUser = firebase.findUser;
