module.exports = app => {
    // 1. CORREÇÃO: URL alterada para "instance-info" (no singular)
    app.get('/api/instance-info', async (req, res) => {
        try {
            // Obtém o token do IMDSv2
            const tokenResponse = await fetch('http://169.254.169.254/latest/api/token', {
                method: 'PUT',
                headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
            });
            const token = await tokenResponse.text();

            // Função auxiliar para buscar os dados sem repetir código
            const fetchMeta = async (path) => {
                try {
                    const r = await fetch(`http://169.254.169.254/latest/meta-data/${path}`, {
                        headers: { 'X-aws-ec2-metadata-token': token }
                    });
                    return r.ok ? await r.text() : "N/A";
                } catch(e) { return "N/A"; }
            };

            // 2. CORREÇÃO: Buscando todos os dados que o seu Banner do React exige
            const instanceId = await fetchMeta('instance-id');
            const instanceType = await fetchMeta('instance-type');
            const availabilityZone = await fetchMeta('placement/availability-zone');
            const region = await fetchMeta('placement/region');
            const privateIp = await fetchMeta('local-ipv4');
            const publicIp = await fetchMeta('public-ipv4');

            // 3. CORREÇÃO: Enviando o JSON no formato exato que o Front-end espera
            res.json({
                    isAWS: true, // Garante que o front-end saiba que está na nuvem
                    instanceId,
                    instanceType,
                    availabilityZone,
                    region
                    localIp,
                    publicIp
                });

        } catch (error) {
            console.error('Erro ao buscar dados IMDSv2:', error.message);
            // Dados de fallback para não quebrar localmente
          res.json({
                isAWS: false, // Informa ao front-end que é ambiente de desenvolvimento
                instanceId: 'localhost',
                instanceType: 'Local Dev',
                availabilityZone: 'N/A',
                localIp: '127.0.0.1',
                publicIp: 'N/A'
            });
        }
    });
};
