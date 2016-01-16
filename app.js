var express = require('express');
var exphbs = require('express-handlebars');
var app = express();
 
// Configure express to use handlebars templates
var hbs = exphbs.create({defaultLayout: 'main'});
app.engine('handlebars', hbs.engine);
app.set('views', __dirname + '/views');
app.set('view engine', 'handlebars');


///////////////////////////////////////
// DB
///////////////////////////////////////
var mongoose = require('mongoose');
mongoose.connect("mongodb://example:example@ds045785.mongolab.com:45785/quick-poll");

var UserSchema = new mongoose.Schema({
    username: {type: String, unique: true, index: true},
    password: {type: String, required: true},
    //name: {type: String, required: true},
    email: {type: String, unique: true, required: true},
    avatar: {type: String, default: "https://www.porternovelli.com/wp-content/themes/pndotcom/img/default_avatar.png"},
    created: { type: Date, default: Date.now },
});
var User = mongoose.model('users', UserSchema);

var PollSchema = new mongoose.Schema({
    username: {type: String, unique: true, index: true},
    title: {type: String, required: true},
    created: { type: Date, default: Date.now },
});
var Poll = mongoose.model('polls', PollSchema);


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

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});


// Routes 
app.get('/', function (req, res) {
  res.render('home', {user: req.user});
});

app.get('/signin', function (req, res) {
  res.render('signin');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/signin'
  })
);

app.post('/signup', function(req, res, next) {
    var password = req.body.password;
    var username = req.body.username;
    var email = req.body.email;
    var avatar = req.body.avatar;

    var user = new User({
        username: username,
        password : password,
        email: email,
        avatar: avatar
    }).save(function (err, newUser) {
        if(err)
        {
          console.log(err);
          return res.redirect('/signin');
        }
        passport.authenticate('local')(req, res, function () {
          res.redirect('/dashboard');
        });
      });
});

app.get('/users/:usr', function (req, res) {
    User.findOne({ username: req.params.usr }, function (err, user) {
      if(err)
        return done(err);
      if (!user)
        res.render('users'  );
      else 
        res.render('users', {user: user});
    });
});

app.get('/dashboard', function (req, res) {
    Poll.find({username: req.user.username}, function(err, polls) {
      console.log(polls);
      res.render('dashboard', {user: req.user, poll: polls}); 
    });
});


app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


app.post('/createPoll', function(req, res, next) {

    var poll = new Poll({
        username: req.user.username,
        title : req.body.title,
    }).save(function (err, newPoll) {
        if(err)
        {
          console.log(err);
          return res.redirect('/dashboard');
        }
        else
          res.redirect('/');
      });
});




app.listen(process.env.PORT || 5000);

