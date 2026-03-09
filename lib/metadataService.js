javascript
/**
metadataService.js
Serviço responsável por buscar os metadados da instância EC2
via AWS Instance Metadata Service v2 (IMDSv2).

IMDSv2 é a versão segura recomendada pela AWS desde 2019.
Funciona apenas dentro de uma instância EC2.
Em ambiente local, retorna valores de fallback para desenvolvimento.
*/
const http = require('http');// ─── Configurações do IMDS
const IMDS_BASE_URL = 'http://169.254.169.254';
const IMDS_TOKEN_TTL = '21600'; // TTL do token em segundos (6 horas)
const TIMEOUT_MS = 2000;        // Timeout para evitar travamento em ambiente local// ─── Cache simples para evitar chamadas repetidas ─────────────────────────────
let cachedMetadata = null;/**

Faz uma requisição HTTP simples (promisificada).


Usamos o módulo nativo http para evitar dependências externas.
*/
function httpRequest(options, postData = null) {
return new Promise((resolve, reject) => {
const req = http.request(options, (res) => {
let data = '';
res.on('data', (chunk) => { data += chunk; });
res.on('end', () => resolve(data.trim()));
});
req.setTimeout(TIMEOUT_MS, () => {
req.destroy();
reject(new Error('IMDS request timeout'));
});
req.on('error', reject);
if (postData) req.write(postData);
req.end();

});
}/**
Obtém o token de sessão IMDSv2.
O token é necessário para todas as chamadas ao IMDS na versão 2.
*/
async function getIMDSToken() {
const options = {
hostname: '169.254.169.254',
path: '/latest/api/token',
method: 'PUT',
headers: {
'X-aws-ec2-metadata-token-ttl-seconds': IMDS_TOKEN_TTL,
},
};
return await httpRequest(options, '');
}/**
Busca um valor específico do IMDS usando o token IMDSv2.
@param {string} token - Token de sessão IMDSv2
@param {string} path  - Caminho do metadado (ex: /latest/meta-data/instance-id)
*/
async function getMetadataValue(token, path) {
const options = {
hostname: '169.254.169.254',
path: path,
method: 'GET',
headers: {
'X-aws-ec2-metadata-token': token,
},
};
return await httpRequest(options);
}/**
Busca todos os metadados relevantes da instância EC2.
Retorna fallback amigável em ambiente local (fora da EC2).

@returns {Promise} Objeto com os dados da instância
*/
async function getInstanceMetadata() {
// Retorna cache se já buscou anteriormente
if (cachedMetadata) {
return { ...cachedMetadata, cached: true };
}
try {
// Etapa 1: Obter token IMDSv2
const token = await getIMDSToken();// Etapa 2: Buscar metadados em paralelo para melhor performance
const [instanceId, localIp, publicIp, instanceType, availabilityZone] = await Promise.all([
  getMetadataValue(token, '/latest/meta-data/instance-id'),
  getMetadataValue(token, '/latest/meta-data/local-ipv4'),
  getMetadataValue(token, '/latest/meta-data/public-ipv4').catch(() => 'N/A'),
  getMetadataValue(token, '/latest/meta-data/instance-type'),
  getMetadataValue(token, '/latest/meta-data/placement/availability-zone'),
]);

// Monta o objeto de metadados
cachedMetadata = {
  instanceId,
  localIp,
  publicIp,
  instanceType,
  availabilityZone,
  environment: 'AWS EC2',<br/>
  timestamp: new Date().toISOString(),
};

return { ...cachedMetadata, cached: false };} catch (error) {
// Fora da EC2 (ambiente local), retorna valores de fallback
console.warn('[MetadataService] IMDS indisponível — usando fallback local:', error.message);return {
  instanceId:        'local-dev',<br/>
  localIp:           '127.0.0.1',<br/>
  publicIp:          'N/A',<br/>
  instanceType:      'local',<br/>
  availabilityZone:  'local',<br/>
  environment:       'Local Development',<br/>
  timestamp:         new Date().toISOString(),<br/>
  cached:            false,
};}
}// Exporta a função principal do serviço
module.exports = { getInstanceMetadata };
