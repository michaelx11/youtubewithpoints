var authConfig = require("./authConfig");
var Youtube = require("youtube-api");

var authenticated = false;

function authenticate() {
  Youtube.authenticate({
    "type": "key",
    "key": authConfig.youtubeServerKey
  });
  authenticated = true;
}

// gets contentDetails and snippet
// snippet.title
// contentDetails.duration
exports.getVideoData = function(id, cbErrorData) {
  if (!authenticated) {
    authenticate();
  }
  Youtube.videos.list({
    "part": "snippet,contentDetails",
    "id": id
  }, function(err, data) {
    if (err || (data.items.length < 1)) {
      cbErrorData(err, false);
    } else {
      cbErrorData(false, data.items[0]);
    }
  });
}
