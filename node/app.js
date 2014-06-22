var express = require('express');
var http = require('http');
var passport = require('passport');
var hbs = require('hbs');
var routes = require('./routes');
var firebase = require('./firebase');
var authConfig = require('./authConfig');
var FacebookStrategy = require("passport-facebook").Strategy;
var favicon = require('serve-favicon');

var app = express();

// all environments


app.set('port', authConfig.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.engine('html', require('hbs').__express);

app.use(express.cookieParser());
app.use(express.logger('dev'));

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(__dirname + '/public'));
app.use(express.session({ secret: 'SECRET' }));
app.use(passport.initialize());
app.use(passport.session());

app.use(favicon(__dirname + '/public/images/favicons/favicon.ico'));
app.use(routes.initialRouter);
app.use(app.router);

passport.use(new FacebookStrategy({
    clientID: authConfig.clientID,
    clientSecret: authConfig.clientSecret,
    callbackURL: authConfig.callbackURL
  },
  function(accessToken, refreshToken, profile, done) {
    firebase.createUserFb(profile.displayName, profile.id, function(error, user) {
      if (error) {
        return done(error);
      }
      done(null, user);
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


/*
passport.use(routes.localStrategy);
passport.serializeUser(function(user, done) { done(null, user.id) });
passport.deserializeUser(routes.findUser);
*/

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.viewer);
app.get('/login', routes.login);
/*
app.post('/login', passport.authenticate('local', {
  successRedirect: '/viewer',
  failureRedirect: '/login'
}));
*/
app.get('/viewer', routes.viewer);

app.get('/logout', routes.logout);
app.get('/register', routes.readyRegister);
app.post('/register', routes.register);
app.get('/submit', routes.readySubmit);
app.post('/submit', routes.submit);
app.post('/like', routes.like);
app.post('/strike', routes.strike);
app.get('/time', routes.time);
app.get('/progress', routes.progress);
app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { successRedirect: '/viewer',
      failureRedirect: '/login' }))

http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
