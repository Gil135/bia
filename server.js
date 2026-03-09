const app = require("./config/express")();

const port = app.get("port");

// ROTA PARA O BANNER DO FRONT-END BUSCAR OS DADOS DA EC2 (IMDSv2)
app.get('/api/instance-infos', async (req, res) => {
    try {
        // 1. Obtém o token do IMDSv2 (Padrão de segurança atual da AWS)
        const tokenResponse = await fetch('http://169.254.169.254/latest/api/token', {
            method: 'PUT',
            headers: {
                'X-aws-ec2-metadata-token-ttl-seconds': '21600'
            }
        });
        const token = await tokenResponse.text();

        // 2. Busca o ID da Instância
        const idResponse = await fetch('http://169.254.169.254/latest/meta-data/instance-id', {
            headers: { 'X-aws-ec2-metadata-token': token }
        });
        const instance_id = await idResponse.text();

        // 3. Busca o IP Privado
        const localIpResponse = await fetch('http://169.254.169.254/latest/meta-data/local-ipv4', {
            headers: { 'X-aws-ec2-metadata-token': token }
        });
        const private_ip = await localIpResponse.text();

        // 4. Busca o IP Público
        // Usamos um bloco try/catch interno pois, se sua EC2 estiver em uma sub-rede privada 
        // atrás do Load Balancer (ALB), ela não terá IP público e essa chamada falharia.
        let public_ip = "N/A";
        try {
            const publicIpResponse = await fetch('http://169.254.169.254/latest/meta-data/public-ipv4', {
                headers: { 'X-aws-ec2-metadata-token': token }
            });
            if (publicIpResponse.ok) {
                public_ip = await publicIpResponse.text();
            }
        } catch (err) {
            console.log("IP Público não encontrado. Instância em Private Subnet.");
        }

        // Envia as informações para o seu front-end exibir no banner
        res.json({
            instance_id: instance_id,
            private_ip: private_ip,
            public_ip: public_ip
        });

    } catch (error) {
        console.error('Erro ao buscar dados da EC2:', error.message);
        // Fallback: se o código rodar no seu computador local em vez da AWS, não quebra a aplicação.
        res.json({
            instance_id: 'local-instance',
            private_ip: '127.0.0.1',
            public_ip: '127.0.0.1'
        });
    }
});


// RODANDO NOSSA APLICAÇÃO NA PORTA SETADA

app.listen(port, () => {
    // ⚠️ CORREÇÃO FEITA AQUI: Faltavam os parênteses e as crases no seu código original
    console.log(`Servidor rodando na porta ${port}`);
});