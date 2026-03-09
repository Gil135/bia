const express        = require('express');
const morgan         = require('morgan');
const session        = require('express-session');
const methodOverride = require('method-override');
const path           = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────
// MIDDLEWARES GLOBAIS
// ──────────────────────────────────────────────

// Log de cada requisição no console
app.use(morgan('dev'));

// Parse de JSON no corpo das requisições (req.body)
app.use(express.json());

// Parse de formulários HTML no corpo das requisições
app.use(express.urlencoded({ extended: true }));

// Simula métodos PUT/DELETE em formulários via ?_method=PUT
app.use(methodOverride('_method'));

// Configuração de sessões
app.use(session({
  secret           : process.env.SESSION_SECRET || 'bia-secret-2026',
  resave           : false,
  saveUninitialized: false,
  cookie           : { secure: false }
}));

// Expõe mensagens de sessão para as views e limpa após uso
app.use((req, res, next) => {
  res.locals.messages    = req.session.messages || [];
  res.locals.hasMessages = !!res.locals.messages.length;
  req.session.messages   = [];
  next();
});

// ──────────────────────────────────────────────
// ARQUIVOS ESTÁTICOS
// ──────────────────────────────────────────────

// Arquivos estáticos do Express (legado)
app.use(express.static(path.join(__dirname, 'app', 'public')));

// Build do React (gerado com: cd client && npm run build)
app.use(express.static(path.join(__dirname, 'client', 'build')));

// ──────────────────────────────────────────────
// HEALTH CHECK
// Usado pelo ALB para verificar se a instância
// está saudável e apta a receber tráfego
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status   : 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ──────────────────────────────────────────────
// METADADOS DA INSTÂNCIA EC2 — IMDSv2
// IMDSv2 exige token temporário antes de acessar
// os metadados (mais seguro que IMDSv1).
// Fora da EC2, retorna dados de fallback para
// não quebrar o frontend em desenvolvimento local.
// ──────────────────────────────────────────────

// Helper: fetch com timeout para não travar o servidor
const fetchWithTimeout = (url, options = {}, timeoutMs = 2000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

app.get('/api/instance-info', async (req, res) => {
  const IMDS_BASE = 'http://169.254.169.254/latest';

  // Busca um metadado específico usando o token IMDSv2
  const getMeta = async (token, metaPath) => {
    try {
      const r = await fetchWithTimeout(
        `${IMDS_BASE}/meta-data${metaPath}`,
        { headers: { 'X-aws-ec2-metadata-token': token } }
      );
      return r.ok ? await r.text() : null;
    } catch {
      return null;
    }
  };

  try {
    // Passo 1: Solicitar token IMDSv2 (TTL = 6 horas)
    const tokenRes = await fetchWithTimeout(`${IMDS_BASE}/api/token`, {
      method : 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
    });

    if (!tokenRes.ok) throw new Error('Falha ao obter token IMDS');
    const token = await tokenRes.text();

    // Passo 2: Buscar todos os metadados em paralelo
    const [instanceId, instanceType, availabilityZone, privateIp, publicIp, hostname] =
      await Promise.all([
        getMeta(token, '/instance-id'),
        getMeta(token, '/instance-type'),
        getMeta(token, '/placement/availability-zone'),
        getMeta(token, '/local-ipv4'),
        getMeta(token, '/public-ipv4'),
        getMeta(token, '/hostname'),
      ]);

    // Extrai a região removendo o último char da AZ
    // Exemplo: "us-east-1a" → "us-east-1"
    const region = availabilityZone ? availabilityZone.slice(0, -1) : null;

    return res.json({
      instanceId,
      instanceType,
      availabilityZone,
      region,
      privateIp,
      publicIp,
      hostname,
      source: 'ec2-imds'
    });

  } catch (err) {
    // Fallback para desenvolvimento local (sem acesso ao IMDS)
    console.warn('[instance-info] IMDS indisponível:', err.message);

    return res.json({
      instanceId      : 'local-dev',
      instanceType    : 'N/A',
      availabilityZone: 'N/A',
      region          : 'N/A',
      privateIp       : '127.0.0.1',
      publicIp        : null,
      hostname        : 'localhost',
      source          : 'fallback-local'
    });
  }
});

// ──────────────────────────────────────────────
// CONTROLLERS — carregados automaticamente via lib/boot
// (rotas das tarefas, autenticação, etc.)
// ──────────────────────────────────────────────
require('./lib/boot')(app, { verbose: false });

// ──────────────────────────────────────────────
// SPA FALLBACK — React Router
// Toda rota não encontrada serve o index.html do React
// Rotas /api/ são ignoradas e tratadas pelo Express
// ──────────────────────────────────────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();

  res.sendFile(
    path.join(__dirname, 'client', 'build', 'index.html'),
    (err) => { if (err) next(); }
  );
});

// ──────────────────────────────────────────────
// HANDLERS DE ERRO
// ──────────────────────────────────────────────

// Erro 500 — erro inesperado no servidor
app.use((err, req, res, next) => {
  console.error('[Erro interno]', err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Erro 404 — rota não encontrada
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada', url: req.originalUrl });
});

// ──────────────────────────────────────────────
// INICIALIZAR SERVIDOR
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor "bia" rodando na porta ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
});
