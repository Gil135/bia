var express      = require('express');
var logger       = require('morgan');
var path         = require('path');
var fs           = require('fs');
var session      = require('express-session');
var methodOverride = require('method-override');

// Serviço que busca os metadados da instância EC2 via IMDSv2
var { getInstanceMetadata } = require('./lib/metadataService');

var app = express();

// ─────────────────────────────────────────────────────────
// Método utilitário para armazenar mensagens na sessão
// Usado pelo sistema de flash messages do projeto
// ─────────────────────────────────────────────────────────
app.response.message = function (msg) {
  var sess = this.req.session;
  sess.messages = sess.messages || [];
  sess.messages.push(msg);
  return this;
};

// Log de requisições HTTP
app.use(logger('dev'));

// Arquivos estáticos (assets do React build e pasta pública)
app.use(express.static(path.join(__dirname, 'app', 'public')));
app.use(express.static(path.join(__dirname, 'client', 'build')));

// Suporte a sessões
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: 'some secret here'
}));

// Parse de formulários
app.use(express.urlencoded({ extended: true }));

// Suporte a method override via query string (?_method=PUT)
app.use(methodOverride('_method'));

// Flash messages disponíveis nas views
app.use(function (req, res, next) {
  var msgs = req.session.messages || [];
  res.locals.messages = msgs;
  res.locals.hasMessages = !!msgs.length;
  next();
  req.session.messages = [];
});

// ─────────────────────────────────────────────────────────
// ROTA PRINCIPAL — Injeta dados da EC2 diretamente no HTML
//
// ⚠️ CLUSTER: Em um cluster de EC2 com Load Balancer, o fetch
// do browser pode cair em qualquer instância.
// A solução é injetar os dados NO MOMENTO em que o servidor
// serve o HTML — garantindo que window.__EC2_INFO__ sempre
// contenha os dados da instância que está respondendo.
// ─────────────────────────────────────────────────────────
app.get('/', function (req, res) {
  var indexPath = path.join(__dirname, 'client', 'build', 'index.html');

  // Verifica se o build do React existe
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Build do React não encontrado. Execute: cd client && npm run build');
  }

  // Busca os metadados da instância EC2
  getInstanceMetadata()
    .then(function (metadata) {
      // Lê o HTML do build
      var html = fs.readFileSync(indexPath, 'utf8');

      // Cria o script com os dados da instância para injeção
      // O React vai ler window.__EC2_INFO__ sem precisar de fetch
      var ec2Script = '<script>window.__EC2_INFO__ = ' + JSON.stringify(metadata) + ';</script>';

      // Injeta o script logo após o <head> — disponível antes do React carregar
      var finalHtml = html.replace('<head>', '<head>\n    ' + ec2Script);

      res.send(finalHtml);
    })
    .catch(function (err) {
      console.error('[index.js] Erro ao buscar metadados:', err.message);
      // Em caso de erro, serve o HTML sem os dados (componente vai mostrar erro)
      var html = fs.readFileSync(indexPath, 'utf8');
      res.send(html);
    });
});

// Carrega os controllers automaticamente via boot.js
// O instanceInfo controller registra GET /api/instance-infos
require('./lib/boot')(app, { verbose: false });

// Handler de erros 500
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Erro interno do servidor');
});

app.listen(3000);
console.log('[BIA] Servidor rodando na porta 3000');
