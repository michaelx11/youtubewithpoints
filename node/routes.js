var model = require('./model');

exports.initialRouter = function(req, res, next) {
  if (req.url === '/login' || req.url === '/register' || (req.url.lastIndexOf('/auth/facebook', 0) === 0) ||
      req.url === '/time') {
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
  var timeIntoSong = "start=" + Math.round(model.getTime());
  res.writeHead(200, {
  'Content-Length': timeIntoSong.length,
  'Content-Type': 'text/plain' })
  res.write(timeIntoSong);
  res.end();
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
    }
    res.end();
  });
}

exports.like = function(req, res) {
  model.like(req.user.username, function(err) {
    if (err) {
      res.send(err);
    }
    res.end();
  });
}

exports.strike = function(req, res) {
  model.strike(req.user.username, req.body.songId, function(err) {
    if (err) {
      res.send(err);
    }
    res.end();
  });
}
