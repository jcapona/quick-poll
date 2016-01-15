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



// Routes 
app.get('/', function (req, res) {
    res.render('home');
});

app.listen(process.env.PORT || 5000);

