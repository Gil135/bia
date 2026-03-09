



/**
 * metadataService.js
 * Responsável por buscar os metadados da instância EC2 via IMDSv2
 * IMDSv2 é mais seguro pois exige um token de sessão antes de acessar os dados
 */

const http = require("http");

// Endpoint interno da AWS - só funciona dentro de uma instância EC2
const METADATA_BASE_URL = "http://169.254.169.254";
const TOKEN_TTL = 21600; // tempo de vida do token em segundos (6 horas)

/**
 * Faz uma requisição HTTP simples (sem dependências externas)
 * @param {object} options - opções do http.request
 * @param {string|null} body - corpo da requisição (para PUT)
 * @returns {Promise<string>} - corpo da resposta
 */
function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error("Timeout ao acessar IMDS"));
    });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Obtém o token de sessão do IMDSv2
 * @returns {Promise<string>} token de sessão
 */
async function getIMDSToken() {
  const options = {
    hostname: "169.254.169.254",
    path: "/latest/api/token",
    method: "PUT",
    headers: {
      "X-aws-ec2-metadata-token-ttl-seconds": String(TOKEN_TTL),
    },
  };
  return await httpRequest(options, "");
}

/**
 * Busca um valor específico dos metadados da EC2
 * @param {string} token - token IMDSv2
 * @param {string} metadataPath - caminho do metadado (ex: instance-id)
 * @returns {Promise<string>} valor do metadado
 */
async function getMetadata(token, metadataPath) {
  const options = {
    hostname: "169.254.169.254",
    path: `/latest/meta-data/${metadataPath}`,
    method: "GET",
    headers: {
      "X-aws-ec2-metadata-token": token,
    },
  };
  return await httpRequest(options);
}

/**
 * Busca todos os dados relevantes da instância EC2
 * Retorna fallback amigável se não estiver rodando na AWS
 * @returns {Promise<object>} dados da instância
 */
async function getInstanceInfo() {
  try {
    // Etapa 1: obter token de sessão (IMDSv2)
    const token = await getIMDSToken();

    // Etapa 2: buscar os metadados em paralelo
    const [instanceId, localIp, publicIp, instanceType, az] =
      await Promise.all([
        getMetadata(token, "instance-id"),
        getMetadata(token, "local-ipv4"),
        getMetadata(token, "public-ipv4").catch(() => "N/A"),
        getMetadata(token, "instance-type"),
        getMetadata(token, "placement/availability-zone"),
      ]);

    return {
      instanceId,
      localIp,
      publicIp,
      instanceType,
      availabilityZone: az,
      environment: "AWS EC2",
      isAWS: true,
    };
  } catch (err) {
    // Fora da EC2 (ex: desenvolvimento local) — retorna fallback
    console.warn("[metadataService] Fora da AWS ou IMDS indisponível:", err.message);
    return {
      instanceId: "local-dev",
      localIp: "127.0.0.1",
      publicIp: "127.0.0.1",
      instanceType: "N/A",
      availabilityZone: "N/A",
      environment: "Local Development",
      isAWS: false,
    };
  }
}

module.exports = { getInstanceInfo };
