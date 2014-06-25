var firebase = require('./firebase');
var LocalStrategy = require('passport-local').Strategy;

var RETRO_BOT = "RetroBot";

var timestamp = 0;
var BUFFER_TIME = 5 * 1000;
var TICK_INTERVAL = 2 * 1000;
var LONELY_INTERVAL = 3 * 1000;
var DELAY_ALLOWANCE = 5;

var isSwitching = false;

function initialize() {
  timestamp = (new Date()).getTime();
  firebase.getHeadMem(function (error, minVideo, queue) {
    if (!error) {
      isPlaying = minVideo.id;
    }
  });
}
initialize();

function tick() {
  firebase.getHeadMem(function (error, minVideo, queue) {
    if (!error) {
      for (var u in queue) {
        var tempVideo = queue[u];
        if (tempVideo.id !== minVideo.id) {
          if (!(tempVideo.strikes === 0) && Object.keys(tempVideo.strikes).length >= 3) {
            // remove bad video
            firebase.popQueueMem(tempVideo, true, function (error) {});
          }
        }
      }
      // strike out
      if (!(minVideo.strikes === 0) && Object.keys(minVideo.strikes).length >= 3) {
          isSwitching = true;
        firebase.popQueueMem(minVideo, true, function (error) {
          if (!error) {
            // get new timestamp
            timestamp = (new Date()).getTime();
          }
          isSwitching = false
        });
      } else { // expire naturally
        var time = (new Date()).getTime();
        var duration = minVideo.duration * 1000;
        // exceeds time limit
        if (time > duration + timestamp + BUFFER_TIME) {
          isSwitching = true;
          // remove the oldest video
          firebase.popQueueMem(minVideo, false, function (error) {
            if (!error) {
              // get new timestamp
              timestamp = (new Date()).getTime();
            }
            isSwitching = false;
          });
        }
      }
    }
  });
}

function lonelyBot() {
  firebase.getQueueMem(function (queue) {
    if (!queue) {
      firebase.getArchiveMem(function (archive) {
        var keys = Object.keys(archive);
        var sample = Math.floor(Math.random() * keys.length);
        var randomVideo = archive[keys[sample]];
        console.log(keys[sample] + " " + randomVideo.name);
        exports.submitVideo(RETRO_BOT, randomVideo.name, randomVideo.link, function(err) {});
      });
    }
  });
}

setInterval(tick, TICK_INTERVAL);
setInterval(lonelyBot, LONELY_INTERVAL);

exports.localStrategy = new LocalStrategy(function(username, password, callback) {
  firebase.getUserMem(username, function(err, user) {
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
  firebase.getUserMem(username, function(err, user) {
    if (user) {
      callback('Username already exists');
    } else {
      firebase.createUserMem(username, bcrypt.hashSync(password, 10), function(err) {
        callback(err);
      });
    }
  });
}

exports.submitVideo = function(username, videoName, linkName, callback) {
  if (linkName.length == 0) {
    callback('Empty Url.');
    return;
  }

  var regexp = /v=([\w-]+)/;
  var match = regexp.exec(linkName);
  var idChunk = '';
  if ((!match) || match.length < 2) {
    var idChunk = linkName.split('/').pop();
// TODO: extra url checks
  } else {
    idChunk = match[1];
  }
  var constructedLink = "http://www.youtube.com/embed/" + idChunk;
  firebase.findVideoQueueMem(constructedLink, function(containsVideo) {
    if (containsVideo) {
      callback('Video already in queue.');
    } else {
      firebase.submitVideoMem(firebase.sanitize(username), videoName, constructedLink, function(err, user) {
        callback(err);
      });
    }
  });
}

exports.like = function(username, songId, callback) {
  firebase.likeMem(firebase.sanitize(username), function(error) {
    callback(error);
  });
}

exports.strike = function(username, songId, callback) {
  firebase.strikeMem(firebase.sanitize(username), songId, function(error) {
    callback(error);
  });
}

exports.getLikes = function(username, callback) {
  firebase.getLikesMem(firebase.sanitize(username), function(error, numLikes) {
    callback(error, numLikes);
  });
}

exports.getStrikes = function(username, callback) {
  firebase.getStrikesMem(firebase.sanitize(username), function(error, numStrikes) {
    callback(error, numStrikes);
  });
}

exports.getTime = function(callback) {
  firebase.getHeadMem(function(error, minVideo, queue) {
    if(error || isSwitching) {
      callback(0);
    } else {
      var returnValue = Math.max((((new Date()).getTime() - timestamp) / 1000 - DELAY_ALLOWANCE), 0);
      if (returnValue > minVideo.duration - BUFFER_TIME / 1000) {
        callback(0);
        return;
      }
      callback(returnValue);
    }
  });
}

exports.getProgress = function(callback) {
  firebase.getHeadMem(function(error, minVideo, queue) {
    if(error) {
      callback("0 99999999");
    } else {
      if (isSwitching) {
        callback('0 ' + minVideo.duration);
        return;
      }
      var returnValue = Math.max((((new Date()).getTime() - timestamp) / 1000 - DELAY_ALLOWANCE), 0);
      if (returnValue > minVideo.duration - BUFFER_TIME / 1000) {
        callback("0 " + minVideo.duration);
        return;
      }
      var printVal = Math.round((100.0 * returnValue) / minVideo.duration) + " " + (Math.max(minVideo.duration - returnValue, 0));
      callback(printVal);
    }
  });
}

exports.findUser = firebase.findUser;
exports.findUserMem = firebase.findUserMem;
exports.updateUserStatus = firebase.updateUserStatus;
exports.updateUserStatusMem = firebase.updateUserStatusMem;
exports.getQueueMem = firebase.getQueueMem;
exports.getUsersMem = firebase.getUsersMem;
