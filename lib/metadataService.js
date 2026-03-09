'use strict';

var http = require('http');


// ─────────────────────────────────────────────────────────────
// metadataService.js
// Busca os metadados da instância EC2 via IMDSv2 (mais seguro).
// IMDSv2 exige um token de sessão antes de acessar os dados.
//
// Cache em memória: os dados são buscados uma única vez e
// reutilizados nas requisições seguintes da mesma instância.
// ─────────────────────────────────────────────────────────────

// Cache em memória — evita chamadas repetidas ao IMDS
var cachedMetadata = null;

// Timeout para requisições ao IMDS (2 segundos)
var TIMEOUT_MS = 2000;

// TTL do token IMDSv2 em segundos (6 horas)
var TOKEN_TTL = '21600';

// ─────────────────────────────────────────────────────────────
// httpRequest — Executa uma requisição HTTP sem dependências externas
// ─────────────────────────────────────────────────────────────
function httpRequest(options, postData) {
  return new Promise(function (resolve, reject) {
    var req = http.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () { resolve(data.trim()); });
    });

    req.setTimeout(TIMEOUT_MS, function () {
      req.destroy();
      reject(new Error('IMDS timeout após ' + TIMEOUT_MS + 'ms'));
    });

    req.on('error', reject);

    if (postData) req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// getIMDSToken — Obtém o token de sessão do IMDSv2
// Necessário para autenticar todas as chamadas ao IMDS
// ─────────────────────────────────────────────────────────────
function getIMDSToken() {
  return httpRequest({
    hostname: '169.254.169.254',
    path: '/latest/api/token',
    method: 'PUT',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': TOKEN_TTL }
  }, '');
}

// ─────────────────────────────────────────────────────────────
// getMetadataValue — Busca um metadado específico usando o token
// ─────────────────────────────────────────────────────────────
function getMetadataValue(token, metadataPath) {
  return httpRequest({
    hostname: '169.254.169.254',
    path: '/latest/meta-data/' + metadataPath,
    method: 'GET',
    headers: { 'X-aws-ec2-metadata-token': token }
  });
}

// ─────────────────────────────────────────────────────────────
// getInstanceMetadata — Função principal exportada
//
// Busca todos os metadados relevantes da instância EC2.
// Retorna fallback amigável quando executado fora da AWS.
// Usa cache para evitar chamadas repetidas ao IMDS.
// ─────────────────────────────────────────────────────────────
function getInstanceMetadata() {
  // Retorna do cache se já foi buscado nessa execução do servidor
  if (cachedMetadata) {
    return Promise.resolve(cachedMetadata);
  }

  return getIMDSToken()
    .then(function (token) {
      // Busca todos os metadados em paralelo
      return Promise.all([
        getMetadataValue(token, 'instance-id'),
        getMetadataValue(token, 'local-ipv4'),
        getMetadataValue(token, 'public-ipv4').catch(function () { return 'N/A'; }),
        getMetadataValue(token, 'instance-type'),
        getMetadataValue(token, 'placement/availability-zone')
      ]);
    })
    .then(function (results) {
      cachedMetadata = {
        instanceId:       results[0],
        localIp:          results[1],
        publicIp:         results[2],
        instanceType:     results[3],
        availabilityZone: results[4],
        environment:      'AWS EC2',
        isAWS:            true
      };
      return cachedMetadata;
    })
    .catch(function (err) {
      // Fora da AWS ou IMDS indisponível — retorna fallback para dev local
      console.warn('[MetadataService] IMDS indisponível, usando fallback:', err.message);
      return {
        instanceId:       'local-dev',
        localIp:          '127.0.0.1',
        publicIp:         'N/A',
        instanceType:     'local',
        availabilityZone: 'local',
        environment:      'Local Development',
        isAWS:            false
      };
    });
}

module.exports = { getInstanceMetadata };
