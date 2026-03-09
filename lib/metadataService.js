'use strict';

var http = require('http');

// Cache em memória — evita múltiplas chamadas ao IMDS na mesma instância
var cachedMetadata = null;

var TIMEOUT_MS = 2000;
var TOKEN_TTL  = '21600';

// Executa uma requisição HTTP sem dependências externas
function httpRequest(options, postData) {
  return new Promise(function (resolve, reject) {
    var req = http.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () { resolve(data.trim()); });
    });
    req.setTimeout(TIMEOUT_MS, function () {
      req.destroy();
      reject(new Error('IMDS timeout'));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Obtém token de sessão IMDSv2 (obrigatório para acessar metadados)
function getIMDSToken() {
  return httpRequest({
    hostname: '169.254.169.254',
    path: '/latest/api/token',
    method: 'PUT',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': TOKEN_TTL }
  }, '');
}

// Busca um metadado específico usando o token obtido
function getMetadataValue(token, metadataPath) {
  return httpRequest({
    hostname: '169.254.169.254',
    path: '/latest/meta-data/' + metadataPath,
    method: 'GET',
    headers: { 'X-aws-ec2-metadata-token': token }
  });
}

// Função principal — retorna Promise com os dados da instância EC2
// Em ambiente local (fora da AWS), retorna fallback automaticamente
function getInstanceMetadata() {
  if (cachedMetadata) {
    return Promise.resolve(cachedMetadata);
  }

  return getIMDSToken()
    .then(function (token) {
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
