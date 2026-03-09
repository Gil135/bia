const http = require('http');

// Cache simples para evitar chamadas repetidas ao IMDS
let cachedMetadata = null;

// Obtém o token de sessão IMDSv2
// O token é necessário para autenticar todas as chamadas ao IMDS
const getToken = (callback) => {
  const options = {
    hostname: '169.254.169.254',
    port: 80,
    path: '/latest/api/token',
    method: 'PUT',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
    timeout: 2000,
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) callback(null, data);
      else callback(new Error('Erro ao obter token: ' + res.statusCode));
    });
  });

  req.on('error', (err) => callback(err));
  req.on('timeout', () => { req.destroy(); callback(new Error('Timeout ao obter token')); });
  req.end();
};

// Busca um metadado específico do IMDS usando o token IMDSv2
const fetchMetadata = (path, token, callback) => {
  const options = {
    hostname: '169.254.169.254',
    port: 80,
    path: '/latest/meta-data/' + path,
    method: 'GET',
    headers: { 'X-aws-ec2-metadata-token': token },
    timeout: 2000,
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) callback(null, data.trim());
      else callback(new Error('Erro ao buscar ' + path + ': ' + res.statusCode));
    });
  });

  req.on('error', (err) => callback(err));
  req.on('timeout', () => { req.destroy(); callback(new Error('Timeout ao buscar ' + path)); });
  req.end();
};

// Função principal — busca todos os metadados da instância EC2
// Retorna fallback amigável quando executado fora da AWS (desenvolvimento local)
const getInstanceMetadata = (callback) => {
  // Retorna do cache se já foi buscado anteriormente
  if (cachedMetadata) {
    return callback(null, cachedMetadata);
  }

  getToken((err, token) => {
    if (err) {
      // Fora da EC2: retorna valores de fallback para desenvolvimento local
      console.warn('[MetadataService] IMDS indisponível, usando fallback:', err.message);
      cachedMetadata = {
        instanceId: 'localhost',
        localIp: '127.0.0.1',
        publicIp: 'N/A',
        instanceType: 'local',
        availabilityZone: 'local',
      };
      return callback(null, cachedMetadata);
    }

    // Busca os 5 metadados da instância
    const paths = [
      'instance-id',
      'local-ipv4',
      'public-ipv4',
      'instance-type',
      'placement/availability-zone',
    ];

    const results = {};
    let completed = 0;

    paths.forEach((path) => {
      fetchMetadata(path, token, (err, value) => {
        results[path] = err ? 'N/A' : value;
        completed++;

        if (completed === paths.length) {
          cachedMetadata = {
            instanceId:        results['instance-id'],
            localIp:           results['local-ipv4'],
            publicIp:          results['public-ipv4'],
            instanceType:      results['instance-type'],
            availabilityZone:  results['placement/availability-zone'],
          };
          callback(null, cachedMetadata);
        }
      });
    });
  });
};

module.exports = { getInstanceMetadata };
