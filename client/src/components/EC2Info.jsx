import React, { useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// EC2Info
// Componente que exibe informações da instância EC2 no Header.
// Busca os dados via GET /api/instance-infos (boot.js do backend).
// Padrão idêntico ao VersionInfo.jsx já existente no projeto.
// ─────────────────────────────────────────────────────────────

const EC2Info = () => {
  // Dados retornados pela API do backend
  const [instanceData, setInstanceData] = useState(null);

  // Status da requisição: 'loading' | 'success' | 'error'
  const [status, setStatus] = useState('loading');

  // Controla abertura/fechamento do tooltip de detalhes
  const [showDetails, setShowDetails] = useState(false);

  // ─────────────────────────────────────────────────────────
  // getApiUrl — Detecta a URL base da API
  // Mesma lógica do VersionInfo.jsx do projeto
  // ─────────────────────────────────────────────────────────
  const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    if (window.location.port === '8080') {
      return window.location.origin;
    }
    return 'http://localhost:8080';
  };

  // ─────────────────────────────────────────────────────────
  // fetchInstanceInfo — Chama GET /api/instance-infos
  // Rota criada pelo boot.js via exports.list no controller
  // ─────────────────────────────────────────────────────────
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

  // Busca na montagem e atualiza a cada 60 segundos
  useEffect(() => {
    fetchInstanceInfo();
    const interval = setInterval(fetchInstanceInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─────────────────────────────────────────────────────────
  // Helpers de exibição
  // ─────────────────────────────────────────────────────────

  const getStatusIcon = () => {
    switch (status) {
      case 'success': return '🟢';
      case 'error':   return '🔴';
      case 'loading': return '🟡';
      default:        return '⚪';
    }
  };

  // Exibe versão curta do Instance ID no botão
  const getShortId = () => {
    if (!instanceData?.instanceId) return 'EC2';
    const id = instanceData.instanceId;
    if (id === 'localhost') return 'Local';
    return id.length > 13 ? `${id.slice(0, 9)}...${id.slice(-4)}` : id;
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="ec2-info-wrapper">

      {/* Botão que exibe o status e abre o tooltip */}
      <button
        className={`ec2-trigger ${status}`}
        onClick={() => setShowDetails(!showDetails)}
        title="Informações da instância EC2"
      >
        {getStatusIcon()} {getShortId()}
      </button>

      {/* Tooltip com os detalhes completos da instância */}
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

          {/* Estado: erro */}
          {status === 'error' && (
            <div className="ec2-row">
              <span className="ec2-label">Status</span>
              <span className="ec2-value ec2-error">Indisponível</span>
            </div>
          )}

          {/* Estado: sucesso — exibe todos os dados */}
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
                <span className={`ec2-badge ${instanceData.isAWS ? 'ec2-badge-aws' : 'ec2-badge-local'}`}>
                  {instanceData.isAWS ? '☁️ AWS EC2' : '🏠 Local Dev'}
                </span>
              </div>
            </>
          )}

          {/* Botão para forçar atualização dos dados */}
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
