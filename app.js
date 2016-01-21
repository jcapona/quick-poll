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
    type: {type: String, required: true},
    answers: [{type: String, required: true}]
});
var Question = mongoose.model('questions', QuestionSchema);


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
app.post('/login', function(req, res) {
  passport.authenticate('local', function(err, user, info) {
    if (err)
    { 
      res.redirect("/signin");
      req.session.error = "Error while logging in.";

    }
    else if(!user)
    {
      res.redirect("/signin");
      req.session.error = "No such user.";
    }

    req.logIn(user, function(err)
    {
      if(err)
      {
        res.redirect("/signin");
        req.session.error = "Error while logging in";
      }
      else
      {
        res.redirect('/dashboard');
        req.session.success = "Welcome back!";
      }
    });
  })(req, res);
});

// Allows to edit questions & answers from a certain poll
app.get('/edit', function(req,res){
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
      if(err)
      {
        req.session.error = err;
        return done(err);
      }
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
  var pollData = {};
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
    if(err)
    {
      req.session.error = err;
      return done(err);
    }
    if (!poll)
    {
      res.render('/');
      req.session.error = "That poll doesn't exist.";
    }
    else 
    {
      pollData.title = poll.title;
      pollData.question = [];
      Question.find({poll_id: poll._id},function(err,question){
        if(err)
        {
          console.error(err);
          req.session.error = err;
          return res.redirect('/');
        }
        for (var i in question)
        {
          var quest = {};
          quest.title = question[i].title;
          quest.answer = question[i].answers;
          /*
          for(var j in question[i].answers)
          {
            quest.answer.push( question[i].answers[j] ;
          }
          */
          pollData.question.push(quest);
        }
        res.contentType('application/json');
        res.send(JSON.stringify(pollData,null,2));
      })
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
          req.session.error = err;
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
      req.session.error = "You must be logged in to use the dashboard";
      
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
    var formData = req.body;

    var question = new Question({
      poll_id: formData.pid,
      title: formData.question,
      type: formData.type,
      answers: formData.answers
    }).save(function(err, newQuestion){
      if(err)
      {
        req.session.error = err;
      }
      else
      {
        req.session.notice = "Poll successfully saved";
        return res.json(formData.pid);
      }
    });
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

      req.session.notice = "Poll deleted successfully";
    }
  });
});

app.listen(process.env.PORT || 5000);

