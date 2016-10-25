var express = require('express');
var pug = require('pug')
var app = express();
var reddit = require('./reddit');
var mysql = require('mysql');
var bodyParser = require('body-parser')

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({
    extended: true
}));

app.set('view engine', 'pug');


var connection = mysql.createConnection({
    host: 'localhost',
    user: 'smolaei',
    password: '',
    database: 'reddit'
});
var redditAPI = reddit(connection);

//Exercise 4: with getAllPosts
app.get('/posts', function(request, response) {
    redditAPI.getAllPosts({
        numPerPage: 5,
        page: 0
    }, "voteScore", function(err, result) {
        if (err) {
            console.log(err);
            response.status(500).send('oops try again later!');
        }
        else {
            response.render('post-list', {
                posts: result
            })
        }
    });
});

//Exercise 5:

app.get('/createContent', function(request, response) {

    response.render('create-content');
});

// //Exercise 6:

app.post('/createContent', function(request, response) {
    var user = {

        url: request.body.url,
        title: request.body.title

    };

    var inputObj = {
        userId: 1,
        url: request.body.url,
        title: request.body.title
    }

    redditAPI.createPost(inputObj, 1, function(err, res) {
        if (err) {
            console.log(err.stack)
        }
        else {
            console.log(res);
        }
    })

    response.redirect('/posts')
})


/* YOU DON'T HAVE TO CHANGE ANYTHING BELOW THIS LINE :) */

// Boilerplate code to start up the web server
var server = app.listen(process.env.PORT, process.env.IP, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
