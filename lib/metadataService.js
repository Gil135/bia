const http = require('http');

const IMDS_TOKEN_TTL = '21600';
const TIMEOUT_MS = 2000;

let cachedMetadata = null;

function httpRequest(options, postData) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(data.trim()); });
    });
    req.setTimeout(TIMEOUT_MS, function() {
      req.destroy();
      reject(new Error('IMDS timeout'));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function getIMDSToken() {
  var options = {
    hostname: '169.254.169.254',
    path: '/latest/api/token',
    method: 'PUT',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': IMDS_TOKEN_TTL }
  };
  return httpRequest(options, '');
}

function getMetadataValue(token, path) {
  var options = {
    hostname: '169.254.169.254',
    path: path,
    method: 'GET',
    headers: { 'X-aws-ec2-metadata-token': token }
  };
  return httpRequest(options);
}

async function getInstanceMetadata() {
  if (cachedMetadata) {
    return cachedMetadata;
  }

  try {
    var token = await getIMDSToken();

    var results = await Promise.all([
      getMetadataValue(token, '/latest/meta-data/instance-id'),
      getMetadataValue(token, '/latest/meta-data/local-ipv4'),
      getMetadataValue(token, '/latest/meta-data/public-ipv4').catch(function() { return 'N/A'; }),
      getMetadataValue(token, '/latest/meta-data/instance-type'),
      getMetadataValue(token, '/latest/meta-data/placement/availability-zone')
    ]);

    cachedMetadata = {
      instanceId: results[0],
      localIp: results[1],
      publicIp: results[2],
      instanceType: results[3],
      availabilityZone: results[4],
      environment: 'AWS EC2',
      isAWS: true
    };

    return cachedMetadata;

  } catch (error) {
    console.warn('[MetadataService] IMDS indisponivel, usando fallback:', error.message);

    return {
      instanceId: 'local-dev',
      localIp: '127.0.0.1',
      publicIp: 'N/A',
      instanceType: 'local',
      availabilityZone: 'local',
      environment: 'Local Development',
      isAWS: false
    };
  }
}

module.exports = { getInstanceMetadata };
