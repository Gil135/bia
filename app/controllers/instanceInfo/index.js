/**
 * Controller: instanceInfo
 * 
 * Segue o padrão exato do boot.js do projeto:
 * - exports.name   → nome do controller (usado na URL)
 * - exports.prefix → prefixo da rota
 * - exports.index  → mapeia para GET /
 * 
 * O boot.js carrega automaticamente este controller
 * por estar na pasta app/controllers/instanceInfo/
 */

const { getInstanceInfo } = require("../../../lib/metadataService");

// Nome do controller (boot.js usa para montar as rotas)
exports.name = "instanceInfo";

// Prefixo vazio = rota na raiz
exports.prefix = "";

/**
 * GET /api/instance-info
 * Retorna os dados da instância EC2 em JSON
 * Usado pelo frontend para exibir as informações
 */
exports.list = async function (req, res) {
  try {
    const info = await getInstanceInfo();
    res.json(info);
  } catch (err) {
    console.error("[instanceInfo] Erro ao buscar metadados:", err.message);
    res.status(500).json({ error: "Erro ao buscar informações da instância" });
  }
};
