import React, { useState, useEffect } from 'react';

// ─────────────────────────────────────────────
// EC2Info — Exibe Instance ID e IP da instância
// Busca os dados via rota /api/instance-infos
// que é registrada automaticamente pelo boot.js
// ─────────────────────────────────────────────

const EC2Info = () => {
  // Estado para armazenar os dados da instância
  const [instanceData, setInstanceData] = useState(null);

  // Estado de carregamento: 'loading' | 'success' | 'error'
  const [status, setStatus] = useState('loading');

  // Controla se o tooltip de detalhes está aberto
  const [showDetails, setShowDetails] = useState(false);

  // ─────────────────────────────────────────
  // Detecta a URL base da API (igual ao VersionInfo.jsx do projeto)
  // ─────────────────────────────────────────
  const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    if (window.location.port === '8080') {
      return window.location.origin;
    }
    return 'http://localhost:8080';
  };

  // ─────────────────────────────────────────
  // Busca os dados da instância EC2 na API
  // Rota: GET /api/instance-infos (gerada pelo boot.js)
  // ─────────────────────────────────────────
  const fetchInstanceInfo = async () => {
    setStatus('loading');
    try {
      const apiUrl = getApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${apiUrl}/api/instance-infos`, {
        signal: controller.signal,
        method: 'GET',
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setInstanceData(data);
      setStatus('success');
    } catch (error) {
      console.warn('[EC2Info] Falha ao buscar metadados:', error.message);
      setStatus('error');
    }
  };

  // Busca ao montar o componente e atualiza a cada 60 segundos
  useEffect(() => {
    fetchInstanceInfo();
    const interval = setInterval(fetchInstanceInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─────────────────────────────────────────
  // Ícone de status baseado no estado atual
  // ─────────────────────────────────────────
  const getStatusIcon = () => {
    switch (status) {
      case 'success': return '🟢';
      case 'error':   return '🔴';
      case 'loading': return '🟡';
      default:        return '⚪';
    }
  };

  // Resumo do Instance ID para exibir no botão (ex: i-0abc...ef12)
  const getShortId = () => {
    if (!instanceData?.instanceId) return 'EC2';
    const id = instanceData.instanceId;
    // Se for localhost (dev local), exibe "Local"
    if (id === 'localhost') return 'Local';
    // Exibe os primeiros 9 e últimos 4 caracteres
    return id.length > 13 ? `${id.slice(0, 9)}...${id.slice(-4)}` : id;
  };

  return (
    <div className="ec2-info-wrapper">
      {/* ── Botão principal que abre/fecha o tooltip ── */}
      <button
        className={`ec2-trigger ${status}`}
        onClick={() => setShowDetails(!showDetails)}
        title="Informações da instância EC2"
      >
        {getStatusIcon()} {getShortId()}
      </button>

      {/* ── Tooltip com detalhes completos ── */}
      {showDetails && (
        <div className="ec2-tooltip">

          <div className="ec2-tooltip-header">
            ☁️ EC2 Instance Info
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div className="ec2-row">
              <span className="ec2-label">Status</span>
              <span className="ec2-value">Carregando...</span>
            </div>
          )}

          {/* Erro */}
          {status === 'error' && (
            <div className="ec2-row">
              <span className="ec2-label">Status</span>
              <span className="ec2-value ec2-error">Indisponível</span>
            </div>
          )}

          {/* Dados carregados com sucesso */}
          {status === 'success' && instanceData && (
            <>
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
                <span
                  className={`ec2-badge ${instanceData.isAWS ? 'ec2-badge-aws' : 'ec2-badge-local'}`}
                >
                  {instanceData.isAWS ? '☁️ AWS EC2' : '🏠 Local Dev'}
                </span>
              </div>
            </>
          )}

          {/* Botão de atualizar */}
          <button
            className="ec2-refresh-btn"
            onClick={fetchInstanceInfo}
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
