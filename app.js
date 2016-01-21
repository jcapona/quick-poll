var express = require('express');
var exphbs = require('express-handlebars');
var app = express();
 
// Configure express to use handlebars templates
var hbs = exphbs.create({defaultLayout: 'main'});
app.engine('handlebars', hbs.engine);
app.set('views', __dirname + '/views');
app.set('view engine', 'handlebars');

// Mongo DB 
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
    username: {type: String, required: true},
    title: {type: String, required: true},
    created: { type: Date, default: Date.now },
});
var Poll = mongoose.model('polls', PollSchema);

var QuestionSchema = new mongoose.Schema({
    poll_id: {type: String, required: true},
    title: {type: String, required: true},
    type: {type: String, required: true}
});
var Question = mongoose.model('questions', QuestionSchema);

var AnswerSchema = new mongoose.Schema({
    poll_id: {type: String, required: true},
    question_id: {type: String, required: true},
    text: {type: String, required: true}
});
var Answer = mongoose.model('answers-all', AnswerSchema);

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
app.use(express.static(__dirname + '/public'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());

// Send messages to view
app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.notice;
  var success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if(err)
    res.locals.error = err;
  if(msg) 
    res.locals.notice = msg;
  if(success) 
    res.locals.success = success;

  next();
});
app.use(app.router);


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

// Logs user in
app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/signin'
  })
);

// Allows to edit questions & answers from a certain poll
app.get('/edit', function(req,res){
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
      if(err)
        return done(err);
      if (!poll)
        res.render('/dashboard');
      else 
      {
        res.render('edit', {poll: poll});
      }
    });
});

// Shows a poll
// Must return a JSON with question + possible answers
app.get('/view', function(req,res){
  //Checks if pid query param exists in DB
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
    if(err)
      return done(err);
    if (!poll)
      res.render('/');
    else 
    {
      res.render('view', {poll: poll});
    }
  });
});

// Signs up user to system and logs him in inmediatly
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

// Display basic user profile info
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

// Displays user's dashboard
app.get('/dashboard', function (req, res) {
    if(req.user == undefined)
    {
      res.redirect('/signin');
    }
    else
    {
      Poll.find({username: req.user.username}, function(err, polls) {
        res.render('dashboard', {user: req.user, poll: polls}); 
      });
    }
});

// Logs out from session
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out!";
});

// Creates new poll in db
app.post('/createPoll', function(req, res, next) {
  var poll = new Poll({
    username: req.user.username,
    title : req.body.title
  }).save(function (err, newPoll) {
    if(err)
    {
      console.log(err);
      return res.redirect('/dashboard');
    }
    else
      res.render('create', {poll: newPoll});
  });
});

// Saves new question to db
app.post('/newQuestion', function(req, res) {
    var question = new Question({
      poll_id: req.body.poll_id,
      title: req.body.title,
      type: req.body.type
    }).save(function(err, newQuestion){
      if(err)
        {
          return console.error(err);
        }
        else
        {
          return res.json(newQuestion._id);
        }
      });
});

// Saves new set of answers to db
app.post('/newAnswer', function(req, res) {
  var answer = new Answer({
    poll_id: req.body.poll_id,
    question_id: req.body.q_id,
    text: req.body.text
  }).save(function(err,newAnswer){
    if(err)
    {
      console.log(err);
      return res.redirect('/dashboard');
    }
    else
    {
      return res.json(newAnswer)
    }
  })

});

// Deletes poll from DB (poll+answers-all+answer-selected)
app.post('/delete', function(req, res) {
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
    if(err)
      return done(err);
    if (!poll)
      res.render('/dashboard');
    else 
    {
      // Performs the delete
    }
  });
});

app.listen(process.env.PORT || 5000);

