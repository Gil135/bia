module.exports = app => {
    app.get('/api/instance-infos', async (req, res) => {
        try {
            // 1. Obtém o token do IMDSv2 (Padrão AWS)
            const tokenResponse = await fetch('http://169.254.169.254/latest/api/token', {
                method: 'PUT',
                headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
            });
            const token = await tokenResponse.text();

            // 2. Busca ID da Instância
            const idResponse = await fetch('http://169.254.169.254/latest/meta-data/instance-id', {
                headers: { 'X-aws-ec2-metadata-token': token }
            });
            const instance_id = await idResponse.text();

            // 3. Busca IP Privado
            const localIpResponse = await fetch('http://169.254.169.254/latest/meta-data/local-ipv4', {
                headers: { 'X-aws-ec2-metadata-token': token }
            });
            const private_ip = await localIpResponse.text();

            // 4. Busca IP Público (com try/catch, pois EC2 em Private Subnet não tem IP Público)
            let public_ip = "N/A";
            try {
                const publicIpResponse = await fetch('http://169.254.169.254/latest/meta-data/public-ipv4', {
                    headers: { 'X-aws-ec2-metadata-token': token }
                });
                if (publicIpResponse.ok) public_ip = await publicIpResponse.text();
            } catch (err) { }

            res.json({ instance_id, private_ip, public_ip });

        } catch (error) {
            console.error('Erro ao buscar dados IMDSv2:', error.message);
            res.json({
                instance_id: 'local-instance',
                private_ip: '127.0.0.1',
                public_ip: '127.0.0.1'
            });
        }
    });
};