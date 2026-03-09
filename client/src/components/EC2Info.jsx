import React, { useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// EC2Info — Identifica qual instância EC2 está servindo a página
//
// ESTRATÉGIA PARA CLUSTER:
// O backend Express injeta os dados da instância diretamente no
// HTML via window.__EC2_INFO__ antes de entregar ao browser.
// Assim, mesmo com Load Balancer na frente, os dados sempre
// correspondem à instância que respondeu a requisição original.
//
// Fallback: se window.__EC2_INFO__ não existir (dev local sem build),
// faz fetch para /api/instance-infos na mesma origem.
// ─────────────────────────────────────────────────────────────

const EC2Info = () => {
  const [instanceData, setInstanceData] = useState(null);
  const [status, setStatus]             = useState('loading');
  const [showDetails, setShowDetails]   = useState(false);

  // ─────────────────────────────────────────────────────────
  // loadData — Carrega os dados da instância
  //
  // Prioridade:
  // 1. window.__EC2_INFO__ (injetado pelo servidor — SEMPRE correto em cluster)
  // 2. fetch /api/instance-infos (fallback para dev local)
  // ─────────────────────────────────────────────────────────
  const loadData = async (isRefresh = false) => {
    setStatus('loading');

    try {
      // ✅ Caminho principal: dados já injetados no HTML pelo Express
      // Em cluster, garante que os dados são da instância que serviu a página
      if (window.__EC2_INFO__ && !isRefresh) {
        setInstanceData(window.__EC2_INFO__);
        setStatus('success');
        return;
      }

      // 🔄 Fallback: fetch direto (dev local ou refresh manual)
      // Usa window.location.origin para garantir mesma origem (sem Load Balancer)
      const response = await fetch(`${window.location.origin}/api/instance-infos`, {
        method: 'GET',
        cache: 'no-cache',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Atualiza o cache global para futuras leituras
      window.__EC2_INFO__ = data;

      setInstanceData(data);
      setStatus('success');

    } catch (error) {
      console.warn('[EC2Info] Falha ao carregar dados:', error.message);
      setStatus('error');
    }
  };

  // Carrega os dados ao montar o componente
  useEffect(() => {
    loadData();
  }, []);

  // ─────────────────────────────────────────────────────────
  // Helpers de exibição
  // ─────────────────────────────────────────────────────────

  // Ícone que indica o status atual da busca
  const getStatusIcon = () => {
    if (status === 'success') return '🟢';
    if (status === 'error')   return '🔴';
    return '🟡';
  };

  // Versão curta do Instance ID para o botão do header
  const getShortId = () => {
    if (!instanceData?.instanceId) return 'EC2';
    const id = instanceData.instanceId;
    if (id === 'local-dev' || id === 'localhost') return 'Local';
    // Exibe inicio e fim para identificação rápida: i-0abc123...ef12
    return id.length > 13 ? `${id.slice(0, 9)}...${id.slice(-4)}` : id;
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="ec2-info-wrapper">

      {/* Botão no header — clique para abrir/fechar o tooltip */}
      <button
        className={`ec2-trigger ${status}`}
        onClick={() => setShowDetails(!showDetails)}
        title="Clique para ver informações desta instância EC2"
      >
        {getStatusIcon()} {getShortId()}
      </button>

      {/* Tooltip com detalhes completos da instância */}
      {showDetails && (
        <div className="ec2-tooltip">

          <div className="ec2-tooltip-header">
            ☁️ EC2 Instance Info
          </div>

          {/* Estado: carregando */}
          {status === 'loading' && (
            <div className="ec2-row">
              <span className="ec2-label">Status</span>
              <span className="ec2-value">Carregando...</span>
            </div>
          )}

          {/* Estado: erro na busca */}
          {status === 'error' && (
            <div className="ec2-row">
              <span className="ec2-label">Status</span>
              <span className="ec2-value ec2-error">API indisponível</span>
            </div>
          )}

          {/* Estado: dados carregados com sucesso */}
          {status === 'success' && instanceData && (
            <div>
              <div className="ec2-row">
                <span className="ec2-label">Instance ID</span>
                <span className="ec2-value">{instanceData.instanceId}</span>
              </div>
              <div className="ec2-row">
                <span className="ec2-label">IP Local</span>
                <span className="ec2-value">{instanceData.localIp}</span>
              </div>
              <div className="ec2-row">
                <span className="ec2-label">IP Público</span>
                <span className="ec2-value">{instanceData.publicIp}</span>
              </div>
              <div className="ec2-row">
                <span className="ec2-label">Tipo</span>
                <span className="ec2-value">{instanceData.instanceType}</span>
              </div>
              <div className="ec2-row">
                <span className="ec2-label">Zona</span>
                <span className="ec2-value">{instanceData.availabilityZone}</span>
              </div>
              <div className="ec2-row">
                <span className="ec2-label">Ambiente</span>
                <span className={`ec2-badge ${instanceData.isAWS ? 'ec2-badge-aws' : 'ec2-badge-local'}`}>
                  {instanceData.isAWS ? '☁️ AWS EC2' : '🏠 Local Dev'}
                </span>
              </div>
            </div>
          )}

          {/* Botão para forçar refresh dos dados via fetch */}
          <button
            className="ec2-refresh-btn"
            onClick={() => loadData(true)}
            disabled={status === 'loading'}
          >
            🔄 {status === 'loading' ? 'Atualizando...' : 'Atualizar'}
          </button>

        </div>
      )}
    </div>
  );
};

export default EC2Info;
