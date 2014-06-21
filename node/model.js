var firebase = require('./firebase');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');

var timestamp = 0;
var BUFFER_TIME = 5 * 1000;
var TICK_INTERVAL = 5 * 1000;

function initialize() {
  timestamp = (new Date()).getTime();
}
initialize();

function tick() {
  firebase.getHead(function (minVideo) {
    // strike out
    if (!(minVideo.strikes === 0) && Object.keys(minVideo.strikes).length >= 3) {
      firebase.popQueue(minVideo, true, function (error) {
        if (!error) {
          // get new timestamp
          timestamp = (new Date()).getTime();
        }
      });
    } else { // expire naturally
      var time = (new Date()).getTime();
      var duration = minVideo.duration * 1000;
      // exceeds time limit
      if (time > duration + timestamp + BUFFER_TIME) {
        // remove the oldest video
        firebase.popQueue(minVideo, false, function (error) {
          if (!error) {
            // get new timestamp
            timestamp = (new Date()).getTime();
          }
        });
      }
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
  var regexp = /v=(\w+)/;
  var match = regexp.exec(linkName);
  if (match.length < 2) {
    callback("Invalid URL");
    return;
  }
  var constructedLink = "http://www.youtube.com/embed/" + match[1];
  firebase.submitVideo(username, videoName, constructedLink, function(err, user) {
    callback(false);
  });
}

exports.like = function(username, callback) {
  firebase.like(username, function(error) {
    callback(error);
  });
}

exports.strike = function(username, songId, callback) {
  firebase.strike(username, songId, function(error) {
    callback(error);
  });
}

exports.getLikes = function(username, callback) {
  firebase.getLikes(username, function(error, numLikes) {
    callback(error, numLikes);
  });
}

exports.getStrikes = function(username, callback) {
  firebase.getStrikes(username, function(error, numStrikes) {
    callback(error, numStrikes);
  });
}

exports.getTime = function() {
  return ((new Date()).getTime() - timestamp) / 1000;
}

exports.findUser = firebase.findUser;
