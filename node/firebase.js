/* Functions that interact with Firebase */

var Firebase = require('firebase');
var authConfig = require('./authConfig');
var firebaseRoot = new Firebase(authConfig.firebaseURL);
firebaseRoot.auth(authConfig.firebaseSecret);
var http = require('http');

// hold the entire thing in memory woohoo
var root = {};
var newArchive = {};
var changedUsers = {};

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

// when local memory is pushed to the database
var PERSIST_INTERVAL = 5 * 1000;
// poll interval
var POLL_INTERVAL = 10 * 1000;

var LIMIT = 2147483649;
var MAX_DURATION = 1000;
var MIN_DURATION = 75;
var RATE_LIMIT = 5;
var RETRO_BOT = "Jeremy Retrobot";
var SONG_BONUS = 5;
var STRIKE_PENALTY = 1;
var ADMIN = {'Michael Xu': true, 
             'Victor Hung': true, 
             'Stephanie Yu': true};

function sleep(millis) {
  var timestamp = (new Date()).getTime();
  while ((new Date()).getTime() - timestamp < millis) {
  }
}

function sanitize(str) {
  console.log(str);
  if (!str) {
    return "UNDEFINED";
  } 
  return str.replace(/[\[\]\.$#,]/g,'');
}

var initialized = false;

function initializeRoot() {
  firebaseRoot.on('value', function(data) {
    if (!data) {
      console.log("ROOT NODE COULD NOT BE OBTAINED, ABORT");
    }
    root = data.val();
    initialized = true;
  });
}

// Initial Load
initializeRoot();

// Hack to allow initialization
sleep(5000);

// Look for a load flag
firebaseRoot.child('flag').on('value', function(data) {
  if (data.val() && data.val() == 'load') {
    console.log('Forced update from firebase.');
    initializeRoot();
  }
  firebaseRoot.child('flag').set('none');
});


function pushToFirebase() {
  try {
    // push the new items to archive
    for (var key in newArchive) {
      var sanKey = sanitize(key);
      firebaseRoot.child('archive').set(sanKey, newArchive[key]);
    }
  } catch(e) {
    console.log("FAILURE PUSHING ITEMS TO ARCHIVE");
    console.log(e);
  }
  
  try {
    // update user info
    for (var user in changedUsers) {
      var sanUser = sanitize(user);
      if (sanUser in root.users) {
        firebaseRoot.child('users').child(sanUser).set(root.users.sanUser);
      } else {
        console.log("FAILED TO FIND USER: " + sanUser);
      }
    }
  } catch(e) {
    console.log("FAIULRE PUSHING USER INFO");
    console.log(e);
  }

  try {
    // update queue info
    firebaseRoot.child('queue').set(root.queue);
  } catch(e) {
    console.log("FAILURE PUSHING QUEUE");
    console.log(e);
  }
}

setInterval(pushToFirebase, PERSIST_INTERVAL);


function hasAdminPrivileges (user) {
  console.log(user);
  console.log(user in ADMIN);
  return user in ADMIN;
}

function createUserFb(username, id, callback) {
  findUser(id, function(notFound, foundUser) {
    var cleanUsername = sanitize(username);
    if (notFound) {
      var user = {
        'id' : id,
        'username' : cleanUsername,
        'score' : 0,
        'userStatus': 'new'
      };

      firebaseRoot.child('users').child(id).set(user);
      callback(false, user);
    } else {
      callback(false, foundUser);
    }
  });
}

function createUserFbMem(username, id, callback) {
  findUserMem(id, function(notFound, foundUser) {
    var cleanUsername = sanitize(username);
    if (notFound) {
      var user = {
        'id' : id,
        'username' : cleanUsername,
        'score' : 0,
        'userStatus': 'new'
      };
      root.users[id] = user;
      changedUsers[id] = true;
      callback(false, user);
    } else {
      callback(false, foundUser);
    }
  });
}

function getUser(username, callback) {
  firebaseRoot.child('users').once('value', function(data) {
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

function getUserMem(username, callback) {
  var users = root.users;
  for (var userKey in users) {
    var user = users.userKey;
    if (user.username == username) {
      callback(false, user);
      return;
    }
  }
  callback(false, false);
}

function findUser(id, callback) {
  firebaseRoot.child('users').child(id).once('value', function(data) {
    if (data.val()) {
      callback(false, data.val());
    } else {
      console.log("User " + id + " was not found.");
      callback(true, null);
    }
  });
}

function findUserMem(id, callback) {
  if (id in root.users) {
    var user = root.users.id;
    if (user) {
      callback(false, user);
    } else {
      console.log("User " + id + " was not found.");
      callback(true, null);
    }
  }
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

        firebaseRoot.child('queue').child(Id).set({
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

function createVideoMem(owner, defaultVideoName, linkName, Id, callback) {
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

        root.queue[Id] = {
          'link': linkName,
          'name': title,
          'owner': owner,
          'strikes' : 0,
          'likes' : 0,
          'duration' : duration,
          'id' : Id
        };

        callback(false);
      } catch (e) {
        console.log(e);
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
  firebaseRoot.child('queue').child(videoObject.id).remove(function() {
    if (videoObject.owner === RETRO_BOT) {
      callback(false);
      return;
    }
    findVideoArchive(videoObject.link, function(contained) {
      if (!contained && !strikeOut) {
        firebaseRoot.child('archive').child(videoObject.id).set(videoObject);
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
          var sanitizedId = sanitize(owner.id);
          if (strikeOut) {
            firebaseRoot.child('users').child(sanitizedId).child('score').transaction(function(score) {
              return score - STRIKE_PENALTY;
            }, function(error, committed, snapshot) {
              // fail silently
              callback(false);
            });
          } else {
            if (videoObject.likes === 0) {
              videoObject.likes = {};
            }
            firebaseRoot.child('users').child(sanitizedId).child('score').transaction(function(score) {
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

function popQueueMem(videoObject, strikeOut, callback) {
  if (videoObject.link === "http://www.youtube.com/embed/dpN3rJWlRx8") {
    callback("Can't nope server messages");
    return;
  }
  if (videoObject.owner === RETRO_BOT) {
    callback(false);
    return;
  }
  findVideoArchiveMem(videoObject.link, function(contained) {
    if (!contained && !strikeOut) {
      newArchive[videoObject.id] = videoObject;
    }

    getUserMem(videoObject.owner, function(error, owner) {
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
        var sanitizedId = sanitize(owner.id);
        if (!(sanitizedId in root.users)) {
          callback("No user: " + sanitizedId);
          return;
        }

        if (!('score' in root.users.sanitizedId))
          root.users.sanitizedId.score = 0;

        if (strikeOut) {
          root.users.sanitizedId.score -= STRIKE_PENALTY;
          changedUsers[sanitizedId] = true;
        } else {
          if (videoObject.likes === 0) {
            videoObject.likes = {};
          }
          try {
            root.users.sanitizedId.score += Object.keys(videoObject.likes).length + SONG_BONUS;
            changedUsers[sanitizedId] = true;
          } catch(e) {
            console.log("Error adding points to user: " + e);
          }
        }
      }
    });
  });
  delete root.queue[videoObject.id];
}

function getQueue(callback) {
  firebaseRoot.child('queue').once('value', function(data) {
    if (data) {
      callback(data.val());
    } else {
      callback(null);
    }
  });
}

function getQueueMem(callback) {
  callback(root.queue);
}

function getArchive(callback) {
  firebaseRoot.child('archive').once('value', function(data) {
    if (data) {
      callback(data.val());
    } else {
      callback(null);
    }
  });
}

function getArchiveMem(callback) {
  callback(root.archive);
}

function getUsersMem(callback) {
  callback(root.users);
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

function findVideoArchiveMem(linkName, callback) {
  getArchiveMem(function(data) {
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

function findVideoQueueMem(linkName, callback) {
  getQueueMem(function(data) {
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
  firebaseRoot.child('queue').once('value', function(data) {
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

function getHeadMem(callback) {
  getQueueMem(function(queue) {
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
  firebaseRoot.child('counters').child('videoID').transaction(function(videoID) {
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

    firebaseRoot.child('queue').once('value', function(data) {
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
        createVideo(sanitize(owner), videoName, linkName, videoID, function(error) {
          callback(error);
        });
      }
    });
  });
}

function submitVideoMem(owner, videoName, linkName, callback) {
  root.counters.videoID += 1;
  var videoID = root.counters.videoID;
  getQueueMem(function(queue) {
    var counter = 0;
    for (var u in queue) {
      if (queue[u].owner === owner) {
        counter++;
      }
    }
    if (counter >= RATE_LIMIT) {
      callback("You have too many videos in the queue.");
    } else {
      createVideoMem(sanitize(owner), videoName, linkName, videoID, function(error) {
        callback(error);
      });
    }
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

function likeMem(username, songId, callback) {
  if (sanitize(songId) !== songId) {
    callback('Invalid song id.');
    return;
  }
  
  var sanUsername = sanitize(username);
  if (!root.queue || !root.queue[songId]) {
    callback('Song does not exist.');
    return;
  }
  var data = root.queue[songId];
  if (data !== null) {
    root.queue[songId]['likes'][sanUsername] = 'likes';
    callback(false);
  } else {
    callback('Song does not exist.');
  }
}

function strike(username, songId, callback) {
  if (sanitize(songId) !== songId) {
    callback('Invalid song id.');
    return;
  }
  firebaseRoot.child('queue').child(songId).on('value', function(data) {
    if (data.val() !== null) {
      firebaseRoot.child('queue').child(songId).child('strikes/' + username).set('striked');
      callback(false);
    } else {
    console.log("FAILED Strike " + songId);
      callback('Song does not exist.');
    }
  });
}

function strikeMem(username, songId, callback) {
  if (sanitize(songId) !== songId) {
    callback('Invalid song id.');
    return;
  }
  
  var sanUsername = sanitize(username);
  if (!root.queue || !root.queue[songId]) {
    callback('Song does not exist.');
    return;
  }
  var data = root.queue[songId];
  if (data !== null) {
    root.queue[songId]['strikes'][sanUsername] = 'striked';
    callback(false);
  } else {
    callback('Song does not exist.');
  }
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

function getLikesMem(minVideo, callback) {
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

function getStrikesMem(minVideo, callback) {
  getQueueMem(function(queue) {
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
  firebaseRoot.child('users').once('value', function(data) {
    var users = data.val();
    for (var userKey in users) {
      var user = users[userKey];
      if (user.username == username) {
        callback(false, user.userStatus);
        firebaseRoot.child('users').child(user.id).child('userStatus').set(newStatus);
        return;
      }
    }
    callback(false, false);
  });
}

function updateUserStatusMem(username, newStatus, callback) {
  var users = root.users;
  if (!users) {
    callback('No users found.');
    return
  }
  for (var userKey in users) {
    var user = users[userKey];
    if (user.username == username) {
      callback(false, user.userStatus);
      root.users[user.id]['userStatus'] = newStatus;
      changedUsers[user.id] = true;
      return;
    }
  }
  callback(false, false);
}

exports.createUserFb = createUserFb;
exports.getUser = getUser;
exports.findUser = findUser;
exports.submitVideo = submitVideo;
exports.getQueue = getQueue;
exports.getArchive = getArchive;
exports.popQueue = popQueue;
exports.getHead = getHead;
exports.like = like;
exports.strike = strike;
exports.getLikes = getLikes;
exports.getStrikes = getStrikes;
exports.findVideoArchive = findVideoArchive
exports.findVideoQueue = findVideoQueue
exports.updateUserStatus = updateUserStatus
exports.sanitize = sanitize

exports.createUserFbMem = createUserFbMem;
exports.getUserMem = getUserMem;
exports.findUserMem = findUserMem;
exports.submitVideoMem = submitVideoMem;
exports.getQueueMem = getQueueMem;
exports.getArchiveMem = getArchiveMem;
exports.popQueueMem = popQueueMem;
exports.getHeadMem = getHeadMem;
exports.likeMem = likeMem;
exports.strikeMem = strikeMem;
exports.getLikesMem = getLikesMem;
exports.getStrikesMem = getStrikesMem;
exports.findVideoArchiveMem = findVideoArchiveMem;
exports.findVideoQueueMem = findVideoQueueMem;
exports.updateUserStatusMem = updateUserStatusMem;
exports.sanitize = sanitize;
exports.getUsersMem = getUsersMem;
