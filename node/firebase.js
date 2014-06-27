/* Functions that interact with Firebase */

var Firebase = require('firebase');
var authConfig = require('./authConfig');
var root = new Firebase(authConfig.firebaseURL);
root.auth(authConfig.firebaseSecret);
var http = require('http');

/*
 * Schema
 *
 * youtubewithpoints
 *   videos
 *     videoData [video name]
 *       link: youtube.com
 *       score: 5
 *       owner: vhung
 *     ...
 *   queue
 *     videoData [video name]
 *       link: youtube.com
 *       strikes: 0
 *       likes: 0
 *       owner: vhung
 *     ...
 *   users
 *     1 [user id]
 *       id: 1
 *       username: sample-user
 *       pwHash: cf7d51e028...
 *       score: 25
 *     2
 *     3
 *     ...
 */

var LIMIT = 2147483649;
var MAX_DURATION = 1000;
var MIN_DURATION = 75;
var RATE_LIMIT = 5;

var ARCHIVE_RANGE_MIN = 1633;
var ARCHIVE_RANGE_MAX = 1900;
var RETRO_BOT = "Jeremy L";
var FAKE_USERS = [RETRO_BOT, "Evelyn K", "Ben F", "Karl L", "Jackie S", "Charles W", "Felix S", "Ralph C"];

var SONG_BONUS = 5;
var STRIKE_PENALTY = 1;
var ADMIN = {'Michael Xu': true, 
             'Victor Hung': true, 
             'Stephanie Yu': true};

// Keep track of current active users
userList = {};
exports.userList = userList;

function sanitizeUsername(username) {
  return username.replace(/[\[\]\.$#,]/g,'');
}

function hasAdminPrivileges (user) {
  console.log(user);
  console.log(user in ADMIN);
  return user in ADMIN;
}

function createUserFb(username, id, callback) {
  findUser(id, function(notFound, foundUser) {
    var cleanUsername = sanitizeUsername(username);
    if (notFound) {
      var user = {
        'id' : id,
        'username' : cleanUsername,
        'score' : 0,
        'userStatus': 'new'
      };

      root.child('users').child(id).set(user);
      callback(false, user);
    } else {
      callback(false, foundUser);
    }
  });
}

function createUser(username, pwHash, callback) {
  root.child('counters').child('userID').transaction(function(userID) {
    return userID + 1;
  }, function(err, committed, data) {
    if (err) {
      callback(err);
      return;
    }
    if (!committed) {
      callback('System error: create user');
      return;
    }
    var userID = data.val();
    root.child('users').child(userID).set({
      'id': userID,
      'username': username,
      'pwHash': pwHash,
      'score' : 0,
      'userStatus': 'new'
    });
    callback(false);
  });
};

function getUser(username, callback) {
  root.child('users').once('value', function(data) {
    var users = data.val();
    for (var userKey in users) {
      var user = users[userKey];
      if (user.username == username) {
        callback(false, user);
        return;
      }
    }
    callback(false, false);
  });
};

function findUser(id, callback) {
  root.child('users').child(id).once('value', function(data) {
    if (data.val()) {
      callback(false, data.val());
    } else {
      console.log("User " + id + " was not found.");
      callback(true, null);
    }
  });
}

function getVideoData(linkName, callback) {
  var id = linkName.split("/").pop();
  http.get(
      "http://gdata.youtube.com/feeds/api/videos/" + id + "?v=2&alt=jsonc",
      function(res) {
        var output = "";
        res.setEncoding("utf8");
        res.on("data", function(chunk) {
          output += chunk;
        });
        res.on("end", function() {
          callback(false, output);
        });
      }).on('error', function(e) {
        callback("Error: " + e.message, "");
      });
}

function createVideo(owner, defaultVideoName, linkName, Id, callback) {
  getVideoData(linkName, function (error, chunk) {
    if (error) {
      callback(error);
    } else {
      try {
        var bodychunk = "";
          bodychunk = JSON.parse(chunk);
        var data = bodychunk.data;
        var title = data.title;
        var duration = parseInt(data.duration);
        if (duration > MAX_DURATION) {
          callback("Video too long.");
          return;
        }
        if (duration < MIN_DURATION && !hasAdminPrivileges(owner)) {
          callback("Video too short.");
          return;
        }

        root.child('queue').child(Id).set({
          'link': linkName,
          'name': title,
          'owner': owner,
          'strikes' : 0,
          'likes' : 0,
          'duration' : duration,
          'id' : Id
        });
        callback(false);
      } catch (e) {
        // Error retrieving vidoe metadata
        callback('Invalid youtube URL. Try a different URL?');
      }
    }
  });
}

function popQueue(videoObject, strikeOut, callback) {
  if (videoObject.link === "http://www.youtube.com/embed/dpN3rJWlRx8") {
    callback("Can't nope server messages");
    return;
  }
  root.child('queue').child(videoObject.id).remove(function() {
    // reset user list
    userList = {};

    if ('retroId' in videoObject || FAKE_USERS.indexOf(videoObject.owner) > -1) {
      callback(false);
      return;
    }
    findVideoArchive(videoObject.link, function(contained) {
      if (!contained && !strikeOut && !('retroId' in videoObject)) {
        videoObject['retroId'] = videoObject.id;
        root.child('archive').child(videoObject.id).set(videoObject);
      }

      getUser(videoObject.owner, function(error, owner) {
        if (error) {
          callback(error);
        } else {
          if (!owner) {
            callback('Owner was not found, looking for: ' + videoObject.owner);
            return;
          }
          if (!owner.id) {
            callback('Owner Id not found! ' + owner.id);
            return;
          }
          var sanitizedId = sanitizeUsername(owner.id);
          if (strikeOut) {
            root.child('users').child(sanitizedId).child('score').transaction(function(score) {
              return score - STRIKE_PENALTY;
            }, function(error, committed, snapshot) {
              // fail silently
              callback(false);
            });
          } else {
            if (videoObject.likes === 0) {
              videoObject.likes = {};
            }
            root.child('users').child(sanitizedId).child('score').transaction(function(score) {
              return score + Object.keys(videoObject.likes).length + SONG_BONUS;
            }, function(error, committed, snapshot) {
              // fail silently
              callback(false);
            });
          }
        }
      });
    });
  });
}

function getRandomFromArchive(callback) {
  var i = 100;
  var min = ARCHIVE_RANGE_MIN;
  var max = ARCHIVE_RANGE_MAX;
  var randSongId = Math.floor(Math.random()*(max-min+1)+min);
  console.log('ATTEMPTING SONG: ' + randSongId);
  root.child('archive/' + randSongId).once('value', function(data) {
    if (data.val() !== null) {
      console.log('passe!');
      callback(data.val());
      return;
    } else {
      getRandomFromArchive(callback);
    }
  })
}

function getQueue(callback) {
  root.child('queue').once('value', function(data) {
    if (data) {
      callback(data.val());
    } else {
      callback(null);
    }
  });
}

function getArchive(callback) {
  root.child('archive').once('value', function(data) {
    if (data) {
      callback(false);
//      callback(data.val());
    } else {
      callback(null);
    }
  });
}

function findVideoArchive(linkName, callback) {
  getArchive(function(data) {
    if (data) {
      for (var vKey in data) {
        var video = data[vKey];
        if (video.link === linkName) {
          callback(true);
          return;
        }
      }
      callback(false);
    } else {
      callback(false);
    }
  });
}

function findVideoQueue(linkName, callback) {
  getQueue(function(data) {
    if (data) {
      for (var vKey in data) {
        var video = data[vKey];
        if (video.link === linkName) {
          callback(true);
          return;
        }
      }
      callback(false);
    } else {
      callback(false);
    }
  });
}

function getHead(callback) {
  root.child('queue').once('value', function(data) {
    var queue = data.val();
    var min = LIMIT;
    var minVideo = {};
    for (var u in queue) {
      var videoObj = queue[u];
      if (videoObj.id < min) {
        minVideo = videoObj;
        min = videoObj.id;
      }
    }
    if (min === LIMIT) {
      callback(true, minVideo, queue);
    } else {
      callback(false, minVideo, queue);
    }
  });
}

function submitVideo(owner, videoName, linkName, callback) {
  root.child('counters').child('videoID').transaction(function(videoID) {
    return videoID + 1;
  }, function(err, committed, data) {
    if (err) {
      callback(err);
      return;
    }
    if (!committed) {
      callback('System error: create video');
      return;
    }
    var videoID = data.val();

    root.child('queue').once('value', function(data) {
      queue = data.val();
      var counter = 0;
      for (var u in queue) {
        if (queue[u].owner === owner) {
          counter++;
        }
      }
      if (counter >= RATE_LIMIT) {
        callback("You have too many videos in the queue.");
      } else {
        createVideo(sanitizeUsername(owner), videoName, linkName, videoID, function(error) {
          callback(error);
        });
      }
    });
  });
}

function like(username, songId, callback) {
  root.child('queue').child(songId).on('value', function(data) {
    if (data.val() !== null) {
      root.child('queue').child(songId).child('likes/' + username).set('liked');
      callback(false);
    } else {
      callback('Song does not exist.');
    }
  });
}

function strike(username, songId, callback) {
  root.child('queue').child(songId).on('value', function(data) {
    if (data.val() !== null) {
      root.child('queue').child(songId).child('strikes/' + username).set('striked');
      callback(false);
    } else {
      callback('Song does not exist.');
    }
  });
}

function getLikes(minVideo, callback) {
  getQueue(function(queue) {
    if (minVideo.id in queue) {
      if (!(minVideo.likes === 0)) {
        callback(false, Object.keys(minVideo.likes).length);
      } else {
        callback(false, 0);
      }
    } else {
      callback("Liked video is no longer in the queue.", 0);
    }
  });
}

function getStrikes(minVideo, callback) {
  getQueue(function(queue) {
    if (minVideo.id in queue) {
      if (!(minVideo.strikes === 0)) {
        callback(false, Object.keys(minVideo.strikes).length);
      } else {
        callback(false, 0);
      }
    } else {
      callback("Striked video is no longer in the queue.", 0);
    }
  });
}

function updateUserStatus(username, newStatus, callback) {
  root.child('users').once('value', function(data) {
    var users = data.val();
    for (var userKey in users) {
      var user = users[userKey];
      if (user.username == username) {
        callback(false, user.userStatus);
        root.child('users').child(user.id).child('userStatus').set(newStatus);
        return;
      }
    }
    callback(false, false);
  });
}

function star(username, songId, title, link, callback) {
  var sanUsername = sanitizeUsername(""+username);
  var sanSongId = sanitizeUsername(""+songId);
  getUser(sanUsername, function(error, user) {
    if (error) {
      callback(error);
      return;
    }
    if (user && sanSongId && title && link) {
      root.child('users/' + user.id + '/stars').once('value', function(starsData) {
        if (starsData && starsData.val()) {
          var stars = starsData.val();
          for (var key in stars) {
            if (stars[key].link === link) {
              callback("Already starred.");
              return;
            }
          }
        }

        root.child('users/' + user.id + '/stars/' + sanSongId).set({
          'title': title,
          'link': link,
          'id': sanSongId
        });
      });
    } else {
      callback("Error starring video.");
    }
  });
}

function unstar(username, link, callback) {
  var sanUsername = sanitizeUsername(""+username);
  getUser(sanUsername, function(error, user) {
    if (error) {
      callback(error);
      return;
    }
    if (user) {
      root.child('users/' + user.id + '/stars/').once('value', 
        function(starsData) {
          if (starsData && starsData.val()) {
            var stars = starsData.val();
            for (var key in stars) {
              if (stars[key].link === link) {
                root.child('users/' + user.id + '/stars/' + key).remove();
              }
            }
          }
          callback(false);
        }
      );
    } else {
      callback("User not found.");
    }
  });
}

function getStars(username, callback) {
  var sanUsername = sanitizeUsername(""+username);
  getUser(sanUsername, function(error, user) {
    if (error) {
      callback(error);
      return;
    }
    if (user) {
      root.child('users/' + user.id + '/stars/').once('value',
        function(data) {
          if (!data || !data.val()) {
            callback({});
          } else {
            callback(data.val());
          }
        }
      );
    } else {
      callback({});
    }
  });
}

exports.createUserFb = createUserFb;
exports.createUser = createUser;
exports.getUser = getUser;
exports.findUser = findUser;
exports.submitVideo = submitVideo;
exports.getRandomFromArchive = getRandomFromArchive;
exports.getQueue = getQueue;
exports.getArchive = getArchive;
exports.popQueue = popQueue;
exports.getHead = getHead;
exports.like = like;
exports.strike = strike;
exports.getLikes = getLikes;
exports.getStrikes = getStrikes;
exports.findVideoArchive = findVideoArchive;
exports.findVideoQueue = findVideoQueue;
exports.updateUserStatus = updateUserStatus;
exports.sanitizeUsername = sanitizeUsername;
exports.star = star;
exports.unstar = unstar;
exports.getStars = getStars;

