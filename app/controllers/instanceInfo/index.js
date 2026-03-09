var metadataService = require('../../../lib/metadataService');

exports.name = 'instance-info';
exports.prefix = '/api';

exports.list = function(req, res) {
  metadataService.getInstanceMetadata()
    .then(function(metadata) {
      return res.status(200).json({
        instanceId: metadata.instanceId,
        localIp: metadata.localIp,
        publicIp: metadata.publicIp,
        instanceType: metadata.instanceType,
        availabilityZone: metadata.availabilityZone,
        environment: metadata.environment,
        isAWS: metadata.isAWS
      });
    })
    .catch(function(error) {
      console.error('[InstanceInfo] Erro:', error.message);
      return res.status(500).json({ error: 'Erro ao buscar informações da instância.' });
    });
};
