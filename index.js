var express        = require('express');
var logger         = require('morgan');
var path           = require('path');
var fs             = require('fs');
var session        = require('express-session');
var methodOverride = require('method-override');

var app = express();

app.response.message = function (msg) {
  var sess = this.req.session;
  sess.messages = sess.messages || [];
  sess.messages.push(msg);
  return this;
};

app.use(logger('dev'));

app.use(express.static(path.join(__dirname, 'app', 'public')));
app.use(express.static(path.join(__dirname, 'client', 'build')));

app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: 'some secret here'
}));


app.use(express.urlencoded({ extended: true }));

app.use(methodOverride('_method'));

app.use(function (req, res, next) {
  var msgs = req.session.messages || [];
  res.locals.messages = msgs;
  res.locals.hasMessages = !!msgs.length;
  next();
  req.session.messages = [];
});

// Carrega os controllers automaticamente (inclui instanceInfo)
require('./lib/boot')(app, { verbose: false });

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Erro interno do servidor');
});

app.use(function (req, res, next) {
  res.status(404).send('Página não encontrada: ' + req.originalUrl);
});

app.listen(3000);
console.log('[BIA] Servidor rodando na porta 3000');
