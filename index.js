var express = require('express');
var app = express();


// Exercise 1
// app.get('/hello', function (req, res) {
//   res.send("<h1>Hello World!</h1>");
// });


// Exercise 2
// app.get('/hello', function (req, res) {
//   res.send("<h1>Hello :" + req.query.name + "!</h1>");
// });


// Exercise 2B
// app.get('/hello/friend/:name', function(req, res, next) { 
//     res.send("<h1>  Hello : " + req.params.name + "</h1"); 
// });

// Exercise 3:

app.get("/calculator/:operation", function(req, res, next) {
    var objResult = {
        "operator": "",
        "firstOperand": req.query.num1,
        "secondOperand": req.query.num2,
        "solution": ""
    }
    if (req.params.operation === 'add') {
        objResult.operator = req.params.operation;
        objResult.solution = Number(req.query.num1) + Number(req.query.num2);
        res.send(JSON.stringify(objResult))
    }
    else if (req.params.operation === 'div'){
        objResult.operator = req.params.operation;
        objResult.solution = Number(req.query.num2) / Number(req.query.num1);
        res.send(JSON.stringify(objResult))
    }
    else if (req.params.operation === 'sub'){
        objResult.operator = req.params.operation;
        objResult.solution = Number(req.query.num2) - Number(req.query.num1);
        res.send(JSON.stringify(objResult))
    }
    else if (req.params.operation === 'mult'){
        objResult.operator = req.params.operation;
        objResult.solution = Number(req.query.num2) * Number(req.query.num1);
        res.send(JSON.stringify(objResult))
    }
    
    else if (req.params.operation !== "mult" || req.params.operation !== "sub" || req.params.operation !== "div" || req.params.operation !== "add"){
        res.status(405).send("Please use amongst the following operators in your query: div, add, mult, sub")
    }
    res.end();
});



/* YOU DON'T HAVE TO CHANGE ANYTHING BELOW THIS LINE :) */

// Boilerplate code to start up the web server
var server = app.listen(process.env.PORT, process.env.IP, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});