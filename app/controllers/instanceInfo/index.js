'use strict';

var metadataService = require('../../../lib/metadataService');

// Nome e prefixo seguem o padrão do lib/boot.js
// boot.js mapeia exports.list → GET /api/instance-infos
exports.name   = 'instance-info';
exports.prefix = '/api';

// GET /api/instance-infos
// Retorna os dados da instância EC2 que está servindo esta requisição
exports.list = function (req, res) {
  metadataService.getInstanceMetadata()
    .then(function (metadata) {
      return res.status(200).json({
        instanceId:       metadata.instanceId,
        localIp:          metadata.localIp,
        publicIp:         metadata.publicIp,
        instanceType:     metadata.instanceType,
        availabilityZone: metadata.availabilityZone,
        environment:      metadata.environment,
        isAWS:            metadata.isAWS
      });
    })
    .catch(function (err) {
      console.error('[instanceInfo] Erro:', err.message);
      return res.status(500).json({ error: 'Erro ao buscar informações da instância.' });
    });
};
