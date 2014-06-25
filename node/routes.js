var model = require('./model');
var authConfig = require('./authConfig.js');

exports.initialRouter = function(req, res, next) {
  if (req.url === '/login' || req.url === '/register' || (req.url.lastIndexOf('/auth/facebook', 0) === 0) ||
      req.url === '/loggedin') {
    next();
  } else if (req.user) {
    console.log(req.user.username + " " + req.url);
    next();
  } else {
    res.redirect('/login');
  }
};

exports.localStrategy = model.localStrategy;

exports.findUser = model.findUser;

exports.viewer = function(req, res) {
  if (req.user) {
    res.render('index.html', {user: req.user.username});
  } else {
    res.redirect('/login');
  }
};

exports.login = function(req, res) {
  if (req.user) {
    res.redirect('/viewer');
  } else {
    res.render('login.html');
  }
};

exports.logout = function(req, res) {
  req.session.regenerate(function() {
    req.logout();
    res.redirect('/login');
  });
}

exports.readyRegister = function(req, res) {
  res.render('ready_register.html', {user: req.user});
}

exports.readySubmit = function(req, res) {
  var problem = req.query.problem;
  res.render('ready_submit.html');
  /*
     model.listProblems(req.user, function(err, problems) {
     res.render('ready_submit.html', {
     user: req.user,
     problem: problems[problem],
     problems: problems,
     problemScoreboard: model.getProblemScoreboard(problem)
     });
     });
     */
}

exports.time = function(req, res) {
  model.getTime(function(time) {
    var timeIntoSong = "start=" + Math.round(time);
    res.writeHead(200, {
    'Content-Length': timeIntoSong.length,
    'Content-Type': 'text/plain' })
    res.write(timeIntoSong);
    res.end();
  });
}

exports.progress = function(req, res) {
  model.getProgress(function(progress) {
    var percentDone = progress;
    res.writeHead(200, {
    'Content-Length': percentDone.length,
    'Content-Type': 'text/plain' })
    res.write(percentDone);
    res.end();
  });
}

exports.getFirebase = function(req, res) {
  var url = authConfig.firebaseURL;
  res.writeHead(200, {
    'Content-Length': url.length,
    'Content-Type': 'text/plain' })
  res.write(url);
  res.end();
}

exports.getUserStatus = function(req, res) {
  model.updateUserStatus(req.user.username, "active", function(error, returnedStatus) {
    var userStatus = "new";
    if (returnedStatus) {
      userStatus = returnedStatus;
    }
    res.writeHead(200, {
      'Content-Length': userStatus.length,
      'Content-Type': 'text/plain' })
    res.write(userStatus);
    res.end();
  });
}

exports.register = function(req, res) {
  model.createUser(req.body.username, req.body.password, req.body.passwordconfirm, function(err) {
    if (err) {
      res.render('ready_register.html', {user: req.user, error: err});
    } else {
      res.render('register.html', {user: req.user, error: err});
    }
  });
}

exports.submit = function(req, res) {
  var link = req.body.link;
  model.submitVideo(req.user.username, link, link, function(err) {
    if (err) {
      res.send(err);
    } else {
      res.end();
    }
  });
}

exports.like = function(req, res) {
  model.like(req.user.username, req.body.songId, function(err) {
    /*
    if (err) {
      res.send(err);
    }
    */
    res.end();
  });
}

exports.strike = function(req, res) {
  model.strike(req.user.username, req.body.songId, function(err) {
    /*
    if (err) {
      res.send(err);
    }
    */
    res.end();
  });
}

exports.isLoggedIn = function(req, res) {
  var loggedIn = "no";
  if(req.user) {
    var loggedIn = "yes";
  }
  res.writeHead(200, {
    'Content-Length': loggedIn.length,
    'Content-Type': 'text/plain' })
  res.write(loggedIn);
  res.end();
}
