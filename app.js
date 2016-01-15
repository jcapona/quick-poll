var express = require('express');
var exphbs = require('express-handlebars');
var app = express();
 
// Configure express to use handlebars templates
var hbs = exphbs.create({
    defaultLayout: 'main', //we will be creating this layout shortly
});
app.engine('handlebars', hbs.engine);
app.set('views', __dirname + '/views');
app.set('view engine', 'handlebars');

///////////////////////////////////////
// DB
///////////////////////////////////////
var mongoose = require('mongoose');
mongoose.connect("mongodb://example:example@ds045785.mongolab.com:45785/quick-poll");

var UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String,
    avatar: String,
    salt: String,
    hash: String
});

var User = mongoose.model('users', UserSchema);



///////////////////////////////////////
///////////////////////////////////////




// Auth strategy
var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
      if(err)
        return done(err);
      if (!user)
        return done(null, false, { message: 'Incorrect username.' });
      if (user.password !== password)
        return done(null, false, { message: 'Incorrect password.' });

      return done(null, user);
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// App configuration
app.configure(function() {
  app.use(express.static('public'));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});


// Routes 
app.get('/', function (req, res) {
    res.render('home');
});

app.get('/signin', function (req, res) {
    res.render('signin');
});

app.post('/login', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err)
      return next(err);
    if (!user)
      return res.redirect('/signin');
    req.logIn(user, function(err) 
    {
      if(err)
        return next(err);
      else
        return res.redirect('/users/' + user.username);
    });
  })(req, res, next);
});

app.get('/users/:usr', function (req, res) {
    console.log(req.params.usr);
    res.render('users', {user: req.params.usr});
});


app.listen(process.env.PORT || 5000);

