// ============================================================
// index.js — Servidor principal Express — Projeto "bia"
// Localização: raiz do projeto (mesmo nível que package.json)
// ============================================================

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

// Log de cada requisição no console (formato compacto "dev")
app.use(morgan('dev'));

// Permite ler JSON no corpo das requisições (req.body)
app.use(express.json());

// Permite ler dados de formulários HTML no corpo das requisições
app.use(express.urlencoded({ extended: true }));

// Permite simular métodos PUT/DELETE em formulários via ?_method=PUT
app.use(methodOverride('_method'));

// Sessões — necessário para autenticação e mensagens flash
app.use(session({
  secret           : process.env.SESSION_SECRET || 'bia-secret-2026',
  resave           : false,
  saveUninitialized: false,
  cookie           : { secure: false } // mudar para true em produção com HTTPS
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

// Serve arquivos da pasta pública do Express (legado)
app.use(express.static(path.join(__dirname, 'app', 'public')));

// Serve o build do React (gerado por: cd client && npm run build)
app.use(express.static(path.join(__dirname, 'client', 'build')));

// ──────────────────────────────────────────────
// HEALTH CHECK — usado pelo ALB para verificar
// se a instância está saudável e pode receber tráfego
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status   : 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ──────────────────────────────────────────────
// INSTÂNCIA EC2 — IMDSv2
//
// IMDSv2 exige um token temporário antes de
// acessar os metadados (mais seguro que IMDSv1).
// O token tem TTL de 6 horas (21600 segundos).
//
// Quando rodando LOCAL (fora da EC2), o fetch
// vai falhar e o catch retorna dados de fallback
// para não quebrar o frontend em desenvolvimento.
// ──────────────────────────────────────────────

// Helper: fetch com timeout para não travar o servidor
const fetchWithTimeout = (url, options = {}, timeoutMs = 2000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

app.get('/api/instance-info', async (req, res) => {
  const IMDS_BASE  = 'http://169.254.169.254/latest';
  const TOKEN_URL  = `${IMDS_BASE}/api/token`;

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
    // Passo 1: Solicitar token IMDSv2
    const tokenRes = await fetchWithTimeout(TOKEN_URL, {
      method : 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
    });

    if (!tokenRes.ok) throw new Error('Falha ao obter token IMDS');
    const token = await tokenRes.text();

    // Passo 2: Buscar metadados em paralelo (melhor performance)
    const [instanceId, instanceType, availabilityZone, privateIp, publicIp, hostname] =
      await Promise.all([
        getMeta(token, '/instance-id'),
        getMeta(token, '/instance-type'),
        getMeta(token, '/placement/availability-zone'),
        getMeta(token, '/local-ipv4'),
        getMeta(token, '/public-ipv4'),
        getMeta(token, '/hostname'),
      ]);

    // Extrai região removendo o último caractere da AZ
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
      source: 'ec2-imds' // indica que veio de uma EC2 real
    });

  } catch (err) {
    // Fallback quando rodando fora da AWS (desenvolvimento local)
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
// SPA FALLBACK — React Router (client-side routing)
// Toda rota não encontrada serve o index.html do React,
// EXCETO rotas /api/ que são tratadas pelo Express
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

// Erro 500 — erros inesperados do servidor
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
