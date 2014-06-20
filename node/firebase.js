/* Functions that interact with Firebase */

var Firebase = require('firebase');
var root = new Firebase('https://youtubewithpoints.firebaseIO.com');
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
      'pwHash': pwHash
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
    callback(false, data.val());
  });
}

function getVideoData(linkName, callback) {
    var id = linkName.split("/").pop();
    http.get(
    "http://gdata.youtube.com/feeds/api/videos/" + id + "?v=2&alt=jsonc",
    function(res) {
        res.on("data", function(chunk) {
            callback(false, chunk.toString("utf8"));
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
          var bodychunk = JSON.parse(chunk);
          var data = bodychunk.data;
          var title = data.title;
          var duration = parseInt(data.duration);

          root.child('queue').child(Id).set({
              'link': linkName,
              'name': title,
              'owner': owner,
              'strikes' : 0,
              'likes' : 0,
              'duration' : duration
          });
          callback(false);
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
      queue = data.val().queue;
      /*
      var counter = 0;
      for (var i = 0; i < queue.length; i++) {
        if (queue[i].owner === owner) {
          counter++;
        }
      }
      if (counter > 3) {
        callback("You have too many videos in the queue.");
      } else {
      */
        createVideo(owner, videoName, linkName, videoID, function(error) {
          callback(false);
        });
//      }
    });
  });
}


exports.createUser = createUser;
exports.getUser = getUser;
exports.findUser = findUser;
exports.submitVideo = submitVideo;
