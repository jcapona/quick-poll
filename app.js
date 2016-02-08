var express = require('express');
var exphbs = require('express-handlebars');
var app = express();
var findOrCreate = require('mongoose-findorcreate');

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
PollSchema.index({username: 1, title: 1}, {unique: true});  
var Poll = mongoose.model('polls', PollSchema);

var QuestionSchema = new mongoose.Schema({
    poll_id: {type: String, required: true},
    title: {type: String, required: true},
    type: {type: String, required: true},
    answers: [{type: String, required: true}]
});
var Question = mongoose.model('questions', QuestionSchema);

var AnswerSchema = new mongoose.Schema({
    poll_id: {type: String, required: true},
    q_id: {type: String, required: true},
    answer: {type: String, required: true}
});
var Answer = mongoose.model('answers', AnswerSchema);

var VoteSchema = new mongoose.Schema({
    poll_id: {type: String, required: true},
    q_id: {type: String, required: true},
    ans_id: {type: String, required: true},
    votes: {type: Number}
});
VoteSchema.plugin(findOrCreate);
var Vote = mongoose.model('votes', VoteSchema);


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
  if(req.user === undefined)
    res.render('signin');
  else
    res.redirect('/dashboard');
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
//app.get('/edit', loggedIn, function(req,res){
  var pollData = {};
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
    if(err)
    {
      req.session.error = err;
      return done(err);
    }
    if (!poll)
    {
      res.redirect('/');
      req.session.error = "That poll doesn't exist.";
    }
    else 
    {
      pollData.title = poll.title;
      pollData.question = [];
      Question.find({poll_id: poll._id},function(err,questions){
        if(err)
        {
          console.error(err);
          req.session.error = err;
          return res.redirect('/');
        }

        questions.forEach(function(qstn,i)
        {
          var quest = {};
          quest.title = qstn.title;
          quest.type = qstn.type;
          quest.answer = [];
          
          Answer.find({q_id: qstn._id}, function(err,ans){
            if(err)
            {
              console.error(err);
              req.session.error = err;
              return res.redirect('/');
            }

            iter(ans,function(err,arr)
            {
              quest.id = ans._id;
              quest.answer = arr;
              pollData.question.push(quest);
              if(questions.length === pollData.question.length)
              {
                //console.log(pollData);
                res.render('edit', {user: req.user, poll: pollData});
              }
            }); 
          });

        });

      })
    }
  });
});

// Shows a poll
// Must return a JSON with question + possible answers
app.get('/view', function(req,res){
  var pollData = {};
  pollData.url = req.headers.host+req.url;
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
    if(err)
    {
      req.session.error = err;
      return res.redirect('/');
    }
    if (!poll)
    {
      req.session.error = "That poll doesn't exist.";
      return res.redirect('/');
    }
    else 
    {
      pollData.title = poll.title;
      pollData.username = poll.username;
      pollData.id = poll._id;
      pollData.question = [];
      Question.find({poll_id: poll._id},function(err,questions){
        if(err)
        {
          console.error(err);
          req.session.error = err;
          return res.redirect('/');
        }

        questions.forEach(function(qstn,i)
        {
          var quest = {};
          quest.title = qstn.title;
          quest.type = qstn.type;
          quest.id = qstn._id;
          quest.answer = [];
          
          Answer.find({q_id: qstn._id}, function(err,ans){
            if(err)
            {
              console.error(err);
              req.session.error = err;
              return res.redirect('/');
            }

            iter(ans,function(err,arr)
            {
              quest.answer = arr;
              pollData.question.push(quest);
              if(questions.length === pollData.question.length)
              {
                //console.log(pollData);
                res.render('view', {user: req.user, poll: pollData});
              }
            }); 
          });

        });

      })
    }
  });
});

function iter(ans,callback)
{
  var answer = [];
  ans.forEach(function(val,index){
    answer.push([val._id, val.answer]);
    if(answer.length == ans.length)
    {
      callback(null,answer)
    }
  });
}

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
          console.error(err);
          req.session.error = err;
          return res.redirect('/signin');
        }
        passport.authenticate('local')(req, res, function () {
          res.redirect('/dashboard');
        });
      });
});

// Gets answers to a poll
app.post('/vote',function(req,res){
  var isError = false;
  // Check for empty form or unanswered questions
  if(Object.keys(req.body).length != Number(Number(req.body.total)+2))
  {
    isError = true;
    console.error("Please, answer all the questions");
    req.session.error = "Please, answer all the questions";
    return res.redirect('view?pid='+req.body.id);
  }

  Question.find({ poll_id: req.body.id }, function (err, questions) {
    if(err && (!isError))
    {
      isError = true;
      console.error(err);
      req.session.error = err.message;
      isError = true;
      return res.redirect('view?pid='+req.body.id);
    }
    var totalQuestions = questions.length;
    var j = 1;

    questions.forEach(function(q,index) {
      Vote.findOrCreate({
        poll_id: req.body.id,
        q_id: q._id,
        ans_id: req.body[q._id]
      },function(err,newVote,created){
        if(err&&(!isError))
        {
          isError = true;
          console.error(err);
          var asd = 'view?pid='+req.body.id;
          req.session.error = "Error saving your preferences. Please try again.";
          return res.redirect(asd.toString());
        }
        else
        {
          var num = newVote.votes == undefined? 1 : newVote.votes + 1;
          Vote.update({
            poll_id: newVote.poll_id,
            q_id: newVote.q_id,
            ans_id: newVote.ans_id,
          },{votes: num},function(err,doc){
            if(err&&(!isError))
            {
              isError = true;
              console.error(err);
              req.session.error = "Error saving your preferences. Please try again.";
              return res.redirect('view?pid='+req.body.id);
            }
            else
            {
              j++;
              if((j == totalQuestions)&&(!isError))
              {
                console.log("Success");
                req.session.success = "Your answers were successfully sent! Thank you!";
                return res.redirect('/results?pid='+req.body.id);
              }
            }
          });

        }
      });
    });
  });
});

// Display basic user profile info
app.get('/users/:usr', function (req, res) {
    User.findOne({ username: req.params.usr }, function (err, userProf) {
      if(err)
        return done(err);
      if (!userProf)
      {
        req.session.error = "The user does not exist.";
        return res.redirect('/');
      }
      else 
      {
        Poll.find({username: req.params.usr}, function(err, polls) {
          res.render('users', {user: req.user, userProfile: userProf, poll:polls});
        });

      }
    });
});

// Displays user's dashboard
app.get('/dashboard', loggedIn, function (req, res) {  
  Poll.find({username: req.user.username}, function(err, polls) {
    res.render('dashboard', {user: req.user, poll: polls, url: req.headers.host}); 
  });
});

// Displays results
app.get('/results', function(req,res){
  if(req.query.pid === undefined)
  {
    req.session.error = "The poll you're trying to access does not exist.";
    return res.redirect('/');
  }

  var pollData = {};
  Poll.findOne({ _id: req.query.pid }, function (err, poll) {
    if(err)
    {
      req.session.error = err;
      return done(err);
    }
    if (!poll)
    {
      res.redirect('/');
      req.session.error = "That poll doesn't exist.";
    }
    else 
    {
      pollData.title = poll.title;
      pollData.question = [];
      Question.find({poll_id: poll._id},function(err,questions){
        if(err)
        {
          console.error(err);
          req.session.error = err;
          return res.redirect('/');
        }

        questions.forEach(function(qstn,i)
        {
          var quest = {};
          quest.title = qstn.title;
          quest.type = qstn.type;
          quest.id = qstn._id;
          quest.answer = [];

          Answer.find({q_id: qstn._id}, function(err,ans){
            if(err)
            {
              console.error(err);
              req.session.error = err;
              return res.redirect('/');
            }
            
            iter(ans,function(err,arr)
            {
              arr.forEach(function(val,index){
                Vote.findOne({ans_id: val[0]}, function(err,votes){
                  val.push(votes.votes);
                  
                  if((arr.length === index + 1)&&(val.length==3))
                  {
                    quest.answer = arr;
                    pollData.question.push(quest);
                    if(questions.length === pollData.question.length)
                    {
                      //console.log(JSON.stringify(pollData,null,2));
                      res.render('results', {user: req.user, poll: pollData});
                    }
                  }
                });  
              });
              
            }); 
          });

        });

      });
    }
  });
});


// Logs out from session
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out!";
});

// Logs out from session
app.get('/delUser', loggedIn, function(req, res){
  res.redirect('/');
  req.session.notice = "User successfully removed.";
});

// Creates new poll in db
app.post('/createPoll', loggedIn, function(req, res, next) {
  var poll = new Poll({
    username: req.user.username,
    title : req.body.title
  }).save(function (err, newPoll) {
    if(err)
    {
      console.error(err);
      req.session.error = "Check your poll name: it can't be blank or be named the same as another of your polls.";
      return res.redirect('/dashboard');
    }
    else
      res.render('create', {poll: newPoll});
  });
});

// Saves new question to db
app.post('/newQuestion', function(req, res) {
    var formData = req.body;
    var ans = formData.answers;

    var question = new Question({
      poll_id: formData.pid,
      title: formData.question,
      type: formData.type
    }).save(function(err, newQuestion){
      if(err)
      {
        req.session.error = err;
      }
      else
      {
        ans.forEach(function(val, index){
          //console.log(val);
          var answer = new Answer({
            poll_id: newQuestion.poll_id,
            q_id: newQuestion._id,
            answer: val
          }).save(function(err,newAns){
            if(err)
              req.session.error = err;
            //else
              //console.log("Saved: "+newAns);
            var vote = new Vote({
              poll_id: formData.pid,
              q_id: newQuestion._id,
              ans_id: newAns._id,
              votes: 0
            }).save(function(err,newVote){
              console.log("Created vote table item :)");
            });
          });
        });

        req.session.notice = "Poll successfully saved";
        return res.json(formData.pid);
      }
    });
});

// Deletes poll from DB (poll+answers-all+answer-selected)
app.post('/delete', loggedIn, function(req, res) {
  Question.findOne({ poll_id : req.body.pid}, function(err,question){
    if(err)
      return done(err);
    else if(question == null)
    {
      res.redirect('/dashboard');
      req.session.error = "The poll is already deleted";
    }
    else
      question.remove(function(err){
        if(err)
          return done(err); 
        else
        {
          Poll.findOne({ _id : req.body.pid}, function(err,poll){
              if(err)
                  return done(err);
              else if(question == null)
              {
                res.redirect('/dashboard');
                req.session.error = "The poll is already deleted";
              }
              else
                poll.remove(function(err){
                  if(err)
                    return done(err); 
                  else
                  {
                    res.redirect('/dashboard');
                    req.session.success = "Poll deleted successfully";
                  }
                });
          });
        }
      });
  });
  });


app.listen(process.env.PORT || 5000);


// Used to check if user is logged in in some routes
function loggedIn(req, res, next) {
  if(req.user) {
    next();
  }
  else {
    res.redirect('/signin');
    req.session.notice = "You must be logged in to see this page.";
  }
}
