# Ou use o comando abaixo para substituir direto (sem abrir editor):
sudo tee /home/ec2-user/bia/index.js << 'EOF'
var express        = require('express');
var logger         = require('morgan');
var path           = require('path');
var session        = require('express-session');
var methodOverride = require('method-override');

var app  = express();
var PORT = process.env.PORT || 3000;

// Método customizado para armazenar mensagens na sessão
app.response.message = function (msg) {
  var sess = this.req.session;
  sess.messages = sess.messages || [];
  sess.messages.push(msg);
  return this;
};

// Log de requisições
app.use(logger('dev'));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'app', 'public')));
app.use(express.static(path.join(__dirname, 'client', 'build')));

// Sessão
app.use(session({
  resave           : false,
  saveUninitialized: false,
  secret           : process.env.SESSION_SECRET || 'bia-secret-2026',
}));

// Parse do body (corrige bug do código original)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sobrescrever método HTTP via query string
app.use(methodOverride('_method'));

// Expor mensagens de sessão para as views
app.use(function (req, res, next) {
  var msgs = req.session.messages || [];
  res.locals.messages    = msgs;
  res.locals.hasMessages = !!msgs.length;
  next();
  req.session.messages = [];
});

// ✅ HEALTH CHECK — ALB verifica se instância está saudável
app.get('/api/health', function (req, res) {
  res.status(200).json({
    status   : 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ✅ METADADOS DA INSTÂNCIA EC2 — IMDSv2
var fetchWithTimeout = function (url, options, timeoutMs) {
  options   = options   || {};
  timeoutMs = timeoutMs || 2000;
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  options.signal = controller.signal;
  return fetch(url, options).finally(function () { clearTimeout(timer); });
};

app.get('/api/instance-info', async function (req, res) {
  var IMDS_BASE = 'http://169.254.169.254/latest';

  var getMeta = async function (token, metaPath) {
    try {
      var r = await fetchWithTimeout(
        IMDS_BASE + '/meta-data' + metaPath,
        { headers: { 'X-aws-ec2-metadata-token': token } }
      );
      return r.ok ? await r.text() : null;
    } catch (e) { return null; }
  };

  try {
    var tokenRes = await fetchWithTimeout(IMDS_BASE + '/api/token', {
      method : 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
    });

    if (!tokenRes.ok) throw new Error('Falha ao obter token IMDS');
    var token = await tokenRes.text();

    var results = await Promise.all([
      getMeta(token, '/instance-id'),
      getMeta(token, '/instance-type'),
      getMeta(token, '/placement/availability-zone'),
      getMeta(token, '/local-ipv4'),
      getMeta(token, '/public-ipv4'),
      getMeta(token, '/hostname'),
    ]);

    var availabilityZone = results[2];
    var region = availabilityZone ? availabilityZone.slice(0, -1) : null;

    return res.json({
      instanceId      : results[0],
      instanceType    : results[1],
      availabilityZone: availabilityZone,
      region          : region,
      localIp         : results[3],
      publicIp        : results[4],
      hostname        : results[5],
      isAWS           : true,
      environment     : process.env.NODE_ENV || 'production'
    });

  } catch (err) {
    console.warn('[instance-info] IMDS indisponível:', err.message);
    return res.json({
      instanceId      : 'local-dev',
      instanceType    : 'N/A',
      availabilityZone: 'N/A',
      region          : 'N/A',
      localIp         : '127.0.0.1',
      publicIp        : null,
      hostname        : 'localhost',
      isAWS           : false,
      environment     : 'local'
    });
  }
});

// Carrega controllers automaticamente
require('./lib/boot')(app, { verbose: false });

// SPA Fallback — React Router
app.get('*', function (req, res, next) {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(
    path.join(__dirname, 'client', 'build', 'index.html'),
    function (err) { if (err) next(); }
  );
});

// Erro 500
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Erro 404
app.use(function (req, res) {
  res.status(404).json({ error: 'Rota não encontrada', url: req.originalUrl });
});

// Inicia servidor usando PORT do ambiente (necessário para ALB)
app.listen(PORT, function () {
  console.log('Servidor bia rodando na porta ' + PORT);
});
EOF