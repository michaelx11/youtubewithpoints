var firebase = require('./firebase');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');

var RETRO_BOT = "Jeremy L";
var FAKE_USERS = [RETRO_BOT, "Evelyn K", "Ben F", "Karl L", "Jackie S", "Charles W", "Felix S", "Ralph C", "Al T", "Samuel S", "Trevor R", "Kevin Z", "Kevin C", "Michael R", "Caroline R", 
    "Stephanie W", "Janet C", "Bob D", "Mike B", "Carl J", "Claire S", "Eddy T", "Eric R",
    "Bobby E", "Larry G"];

var timestamp = 0;
var BUFFER_TIME = 5 * 1000;
var TICK_INTERVAL = 2 * 1000;
var LONELY_INTERVAL = 20 * 1000;
var DELAY_ALLOWANCE = 5;
var QUEUE_LENGTH_CUTOFF = 8;

var currentStreak = 0;
var currentUser = "";

var isSwitching = false;

function initialize() {
  timestamp = (new Date()).getTime();
  firebase.getHead(function (error, minVideo, queue) {
    if (!error) {
      var isPlaying = minVideo.id;
    }
  });
}
initialize();

function isBotSong(videoObject) {
  return FAKE_USERS.indexOf(videoObject.owner) > -1;
}

function tick() {
  firebase.getHead(function (error, minVideo, queue) {
    if (!error && !isSwitching) {
      for (var u in queue) {
        var tempVideo = queue[u];
        if (tempVideo.id !== minVideo.id) {
          if (!(tempVideo.strikes === 0) && Object.keys(tempVideo.strikes).length >= 3) {
            // remove bad video
            exports.userList = {};
            firebase.popQueue(tempVideo, true, function (error) {});
          }
        }
      }
      // strike out
      if (!(minVideo.strikes === 0) && Object.keys(minVideo.strikes).length >= 3) {
        isSwitching = true;
        exports.userList = {};
        firebase.popQueue(minVideo, true, function (error) {
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
          exports.userList = {};
          firebase.popQueue(minVideo, false, function (error) {
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
  firebase.getQueue(function (queue) {
    var qLen = 0;
    if (queue) {
      qLen = Object.keys(queue).length;
    }
    // Randomly add songs as fake users
    if (qLen <= QUEUE_LENGTH_CUTOFF) {
      if (Math.random() > Math.pow(qLen * .15, .25)) {
        if (currentStreak <= 0) {
          var index = Math.floor(Math.random() * FAKE_USERS.length);
          currentUser = FAKE_USERS[index];
          currentStreak = Math.floor(Math.random() * 4 + 1);
        }
        currentStreak--;
        firebase.getRandomFromArchive(function (video) {
          console.log(video);
          exports.submitVideo(currentUser, video.name, video.link, function(err) {});
        });
      }
    }
    // Randomly strike songs as fake users
    if (qLen > 0) {
      var sortedQueueKeys = Object.keys(queue).sort();
      for (var index in sortedQueueKeys) {
        var key = sortedQueueKeys[index];
        var randomValue = Math.random();
        var numStrikes = 0;
        var userIndex = Math.floor(Math.random() * FAKE_USERS.length);
        var fakeStriker = FAKE_USERS[userIndex];
 
        if (queue[key].strikes != 0) {
          numStrikes = Object.keys(queue[key].strikes).length;
        }
        if (index == 0) {
          if (randomValue > .96 - (.05 * numStrikes)) {
            console.log(fakeStriker + " struck: " + queue[key].name);
            exports.strike(fakeStriker, key, function(err){});
          }
        } else {
          if (randomValue > .98 - (.05 * numStrikes)) {
            console.log(fakeStriker + " struck: " + queue[key].name);
            exports.strike(fakeStriker, key, function(err){});
          }
        }
      }
    }
  });
}

setInterval(tick, TICK_INTERVAL);
setInterval(lonelyBot, LONELY_INTERVAL);

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
  if (linkName.length == 0) {
    callback('Empty Url.');
    return;
  }

  var regexp = /v=([\w-_]+)/;
  var match = regexp.exec(linkName);
  var idChunk = '';
  if ((!match) || match.length < 2) {
    var embedexp = /embed\/([\w-_]+)/;
    var match2 = embedexp.exec(linkName);
    if (match2 && match2.length >= 2) {
      idChunk = match2[1];
    } else {
      idChunk = linkName.split('/').pop();
    }
// TODO: extra url checks
  } else {
    idChunk = match[1];
  }
  var constructedLink = "http://www.youtube.com/embed/" + idChunk;
  firebase.findVideoQueue(constructedLink, function(containsVideo) {
    if (containsVideo) {
      callback('Video already in queue.');
    } else {
      firebase.submitVideo(firebase.sanitizeUsername(username), videoName, constructedLink, function(err, user) {
        callback(err);
      });
    }
  });
}

exports.like = function(username, songId, callback) {
  firebase.like(firebase.sanitizeUsername(username), songId, function(error) {
    callback(error);
  });
}

exports.strike = function(username, songId, callback) {
  firebase.strike(firebase.sanitizeUsername(username), songId, function(error) {
    callback(error);
  });
}

exports.getLikes = function(username, callback) {
  firebase.getLikes(firebase.sanitizeUsername(username), function(error, numLikes) {
    callback(error, numLikes);
  });
}

exports.getStrikes = function(username, callback) {
  firebase.getStrikes(firebase.sanitizeUsername(username), function(error, numStrikes) {
    callback(error, numStrikes);
  });
}

exports.getTime = function(callback) {
  firebase.getHead(function(error, minVideo, queue) {
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
  firebase.getHead(function(error, minVideo, queue) {
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
exports.updateUserStatus = firebase.updateUserStatus;
exports.star = firebase.star;
exports.unstar = firebase.unstar;
exports.getStars = firebase.getStars;
exports.userList = firebase.userList;
