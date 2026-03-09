// ============================================================
// index.js — Servidor principal Express
// Serve o React app + API de metadados EC2 + Health Check ALB
// ============================================================

var express = require("express");
var logger = require("morgan");
var path = require("path");
var session = require("express-session");
var methodOverride = require("method-override");

var app = express();

// ──────────────────────────────────────────────
// Porta via variável de ambiente ou fallback 3000
// ──────────────────────────────────────────────
var port = process.env.PORT || 3000;

// ──────────────────────────────────────────────
// MIDDLEWARES
// ──────────────────────────────────────────────

// Log de requisições no console
app.use(logger("dev"));

// Parse de JSON e form data (corrige o bug do (req.body) original)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sobrescrever método HTTP via query string (?_method=put)
app.use(methodOverride("_method"));

// Sessões
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET || "bia-secret-2026",
  })
);

// Expor mensagens de sessão para as views
app.use(function (req, res, next) {
  var msgs = req.session.messages || [];
  res.locals.messages = msgs;
  res.locals.hasMessages = !!msgs.length;
  next();
  req.session.messages = [];
});

// ──────────────────────────────────────────────
// ARQUIVOS ESTÁTICOS (React build + app/public)
// ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "app", "public")));
app.use(express.static(path.join(__dirname, "client", "build")));

// ──────────────────────────────────────────────
// HEALTH CHECK — usado pelo ALB (Load Balancer)
// Retorna 200 OK para que o ALB saiba que a
// instância está saudável e pode receber tráfego
// ──────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// ──────────────────────────────────────────────
// ENDPOINT: Metadados da Instância EC2 (IMDSv2)
//
// IMDSv2 é mais seguro que o v1 pois exige um
// token temporário antes de expor os metadados.
// Quando rodando local (fora da EC2), retorna
// dados de fallback para não quebrar o frontend.
// ──────────────────────────────────────────────
app.get("/api/instance-info", async (req, res) => {
  // URL base do IMDS (só acessível dentro da EC2)
  const IMDS_BASE = "http://169.254.169.254/latest";

  // Helper: fetch com timeout de 2 segundos
  const fetchWithTimeout = (url, options = {}, timeoutMs = 2000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );
  };

  // Helper: busca um metadado específico usando o token
  const getMeta = async (token, path) => {
    try {
      const response = await fetchWithTimeout(
        `${IMDS_BASE}/meta-data${path}`,
        { headers: { "X-aws-ec2-metadata-token": token } }
      );
      return response.ok ? await response.text() : null;
    } catch {
      return null;
    }
  };

  try {
    // Passo 1: Solicitar token IMDSv2 (TTL = 6 horas)
    const tokenResponse = await fetchWithTimeout(
      `${IMDS_BASE}/api/token`,
      {
        method: "PUT",
        headers: { "X-aws-ec2-metadata-token-ttl-seconds": "21600" },
      }
    );

    if (!tokenResponse.ok) throw new Error("Token IMDS não retornou OK");

    const token = await tokenResponse.text();

    // Passo 2: Buscar os metadados em paralelo para melhor performance
    const [instanceId, instanceType, availabilityZone, privateIp, publicIp, hostname] =
      await Promise.all([
        getMeta(token, "/instance-id"),
        getMeta(token, "/instance-type"),
        getMeta(token, "/placement/availability-zone"),
        getMeta(token, "/local-ipv4"),
        getMeta(token, "/public-ipv4"),
        getMeta(token, "/hostname"),
      ]);

    // Extrair a região a partir da AZ (ex: us-east-1a → us-east-1)
    const region = availabilityZone ? availabilityZone.slice(0, -1) : null;

    return res.json({
      instanceId,
      instanceType,
      availabilityZone,
      region,
      privateIp,
      publicIp,
      hostname,
      // Indica que os dados vieram da EC2 real
      source: "ec2-imds",
    });
  } catch (err) {
    // Quando rodando local (sem acesso ao IMDS), retorna dados de fallback
    // para o frontend não quebrar durante desenvolvimento
    console.warn("[instance-info] Fora da EC2 ou IMDS indisponível:", err.message);

    return res.json({
      instanceId: "local-dev",
      instanceType: "N/A",
      availabilityZone: "N/A",
      region: "N/A",
      privateIp: "127.0.0.1",
      publicIp: null,
      hostname: "localhost",
      source: "fallback-local",
    });
  }
});

// ──────────────────────────────────────────────
// CONTROLLERS — carrega automaticamente via lib/boot
// ──────────────────────────────────────────────
require("./lib/boot")(app, { verbose: false });

// ──────────────────────────────────────────────
// SPA FALLBACK — React Router (client-side routing)
// Qualquer rota não encontrada serve o index do React
// ──────────────────────────────────────────────
app.get("*", (req, res, next) => {
  // Não interceptar rotas de API
  if (req.path.startsWith("/api/")) return next();

  const indexPath = path.join(__dirname, "client", "build", "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) next(); // Se não achar o build React, deixa o Express lidar
  });
});

// ──────────────────────────────────────────────
// HANDLERS DE ERRO
// ──────────────────────────────────────────────
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno do servidor" });
});

app.use(function (req, res) {
  res.status(404).json({ error: "Rota não encontrada", url: req.originalUrl });
});

// ──────────────────────────────────────────────
// INICIALIZAR SERVIDOR
// ──────────────────────────────────────────────
app.listen(port, () => {
  console.log(`✅ Servidor rodando na porta ${port}`);
});
