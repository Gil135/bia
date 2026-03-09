var express = require("express");
var logger = require("morgan");
var path = require("path");
var session = require("express-session");
var methodOverride = require("method-override");

var app = express();

// define a custom res.message() method
// which stores messages in the session
app.response.message = function (msg) {
  var sess = this.req.session;
  sess.messages = sess.messages || [];
  sess.messages.push(msg);
  return this;
};

// log
app.use(logger("dev"));

// serve static files
app.use(express.static(path.join(__dirname, "app", "public")));
app.use(express.static(path.join(__dirname, "client", "build")));

// session support
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: "some secret here",
  })
);

// parse request bodies (linha corrigida — removido o "(req.body)" inválido)
app.use(express.urlencoded({ extended: true }));

// allow overriding methods in query (?_method=put)
app.use(methodOverride("_method"));

// expose "messages" local variable when views are rendered
app.use(function (req, res, next) {
  var msgs = req.session.messages || [];
  res.locals.messages = msgs;
  res.locals.hasMessages = !!msgs.length;
  next();
  req.session.messages = [];
});

// load controllers (registra automaticamente o instanceInfo)
require("./lib/boot")(app, { verbose: false });

// error handler
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).render("5xx");
});

// 404 handler
app.use(function (req, res, next) {
  res.status(404).render("404", { url: req.originalUrl });
});

app.listen(3000);
console.log("Express started on port 3000");
