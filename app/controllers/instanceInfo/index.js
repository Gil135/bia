/**
 * Controller: instanceInfo
 *
 * Segue o padrão do lib/boot.js do projeto BIA.
 * O boot.js mapeia automaticamente:
 *   exports.list → GET /api/instance-infos
 */

const { getInstanceMetadata } = require('../../../lib/metadataService');

// Nome do controller — usado pelo boot.js para montar a URL
exports.name = 'instance-info';

// Prefixo da rota — rota final será: GET /api/instance-infos
exports.prefix = '/api';

/**
 * GET /api/instance-infos
 * Retorna os metadados da instância EC2 em JSON plano (sem wrapper)
 */
exports.list = function (req, res) {
  getInstanceMetadata(function (err, metadata) {
    if (err) {
      console.error('[instanceInfo] Erro ao buscar metadados:', err.message);
      return res.status(500).json({ error: 'Erro ao buscar informações da instância.' });
    }

    // Determina se está rodando na AWS
    var isAWS = metadata.instanceId !== 'localhost';

    // Retorna JSON plano — o frontend acessa data.instanceId diretamente
    return res.status(200).json({
      instanceId:       metadata.instanceId,
      localIp:          metadata.localIp,
      publicIp:         metadata.publicIp,
      instanceType:     metadata.instanceType,
      availabilityZone: metadata.availabilityZone,
      environment:      isAWS ? 'AWS EC2' : 'Local Development',
      isAWS:            isAWS,
    });
  });
};
