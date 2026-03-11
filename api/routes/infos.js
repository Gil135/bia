const http = require('http');

module.exports = app => {
    app.get('/api/instance-info', async (req, res) => {
        
        // Função customizada super robusta usando o módulo nativo HTTP
        const requestMetadata = (path, method = 'GET', headers = {}) => {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: '169.254.169.254',
                    port: 80,
                    path: path,
                    method: method,
                    headers: headers,
                    timeout: 2000 // Limite de 2 segundos para não travar o servidor
                };

                const reqObj = http.request(options, (response) => {
                    let data = '';
                    response.on('data', chunk => { data += chunk; });
                    response.on('end', () => {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve(data);
                        } else {
                            reject(new Error(`HTTP Error: ${response.statusCode}`));
                        }
                    });
                });

                reqObj.on('error', (e) => reject(e));
                reqObj.on('timeout', () => {
                    reqObj.destroy();
                    reject(new Error('Timeout na requisição. Possível bloqueio de Hop Limit (Docker).'));
                });
                reqObj.end();
            });
        };

        try {
            // 1. Obtém o token do IMDSv2
            const token = await requestMetadata('/latest/api/token', 'PUT', {
                'X-aws-ec2-metadata-token-ttl-seconds': '21600'
            });

            // 2. Função auxiliar usando o token de segurança
            const fetchMeta = async (path) => {
                try {
                    return await requestMetadata(`/latest/meta-data/${path}`, 'GET', {
                        'X-aws-ec2-metadata-token': token
                    });
                } catch(e) {
                    return "N/A";
                }
            };

            // 3. Busca todos os dados da máquina
            const instanceId = await fetchMeta('instance-id');
            const instanceType = await fetchMeta('instance-type');
            const availabilityZone = await fetchMeta('placement/availability-zone');
            const region = await fetchMeta('placement/region');
            const localIp = await fetchMeta('local-ipv4');
            const publicIp = await fetchMeta('public-ipv4');

            res.json({
                isAWS: true,
                instanceId,
                instanceType,
                availabilityZone,
                region,
                localIp,
                publicIp
            });

        } catch (error) {
            console.error('Erro ao buscar dados IMDSv2:', error.message);
            // Se falhar (ex: rodando no PC ou bloqueio do Docker), envia o fallback
            res.json({
                isAWS: false,
                instanceId: 'localhost',
                instanceType: 'Local Dev',
                availabilityZone: 'N/A',
                localIp: '127.0.0.1',
                publicIp: 'N/A'
            });
        }
    });
};