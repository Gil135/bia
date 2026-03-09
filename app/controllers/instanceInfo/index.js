/**
 * instanceInfo Controller
 *
 * Segue o padrão exato do lib/boot.js do projeto BIA.
 * O boot.js lê pastas dentro de app/controllers/ e mapeia
 * os exports automaticamente para rotas Express.
 *
 * Mapeamento do boot.js:
 *   export "list" → GET /api/instance-infos
 *
 * Rota final: GET /api/instance-infos
 */

const { getInstanceMetadata } = require('../../../lib/metadataService');

// ─── Configurações do controller 

/**
 * Nome do controller — usado pelo boot.js para montar a URL.
 * Com prefix "/api" e nome "instance-info", a rota "list" gera:
 * GET /api/instance-infos
 */
exports.name = 'instance-info';

/**
 * Prefixo da rota — todas as URLs deste controller terão este prefixo.
 */
exports.prefix = '/api';

// ─── Handlers 

/**
 * GET /api/instance-infos
 *
 * Retorna os metadados da instância EC2 em formato JSON.
 * Usado pelo frontend (index.html) para exibir IP e Instance ID.
 */
exports.list = async function (req, res) {
  try {
    const metadata = await getInstanceMetadata();

    // Retorna os dados com status 200
    return res.status(200).json({
      success: true,<br/>
      data: metadata,
    });

  } catch (error) {
    console.error('[InstanceInfo] Erro ao buscar metadados:', error.message);

    return res.status(500).json({
      success: false,<br/>
      message: 'Erro ao buscar informações da instância.',<br/>
      error: error.message,
    });
  }
};
