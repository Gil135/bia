import React, { useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// EC2Info — Exibe Instance ID e IP da instância EC2 no Header
// Busca dados via GET /api/instance-infos (registrada pelo boot.js)
// ─────────────────────────────────────────────────────────────

const EC2Info = () => {
  const [instanceData, setInstanceData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [showDetails, setShowDetails] = useState(false);

  // Detecta a URL base correta da API
  // Backend Express roda na porta 3000
  const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (window.location.port === '3000') return window.location.origin;
    // Em produção na AWS, usa a mesma origem (sem porta)
    if (window.location.port === '' || window.location.port === '80') {
      return window.location.origin;
    }
    // Fallback para dev local — backend Express na porta 3000
    return 'http://localhost:3000';
  };

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

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setInstanceData(data);
      setStatus('success');
    } catch (error) {
      console.warn('[EC2Info] Falha ao buscar metadados:', error.message);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchInstanceInfo();
    const interval = setInterval(fetchInstanceInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (status === 'success') return '🟢';
    if (status === 'error') return '🔴';
    return '🟡';
  };

  const getShortId = () => {
    if (!instanceData?.instanceId) return 'EC2';
    const id = instanceData.instanceId;
    if (id === 'localhost' || id === 'local-dev') return 'Local';
    return id.length > 13 ? `${id.slice(0, 9)}...${id.slice(-4)}` : id;
  };

  return (
    <div className="ec2-info-wrapper">
      <button
        className={`ec2-trigger ${status}`}
        onClick={() => setShowDetails(!showDetails)}
        title="Informações da instância EC2"
      >
        {getStatusIcon()} {getShortId()}
      </button>

      {showDetails && (
        <div className="ec2-tooltip">
          <div className="ec2-tooltip-header">☁️ EC2 Instance Info</div>

          {status === 'loading' && (
            <div className="ec2-row">
              <span className="ec2-label">Status</span>
              <span className="ec2-value">Carregando...</span>
            </div>
          )}

          {status === 'error' && (
            <div className="ec2-row">
              <span className="ec2-label">Status</span>
              <span className="ec2-value ec2-error">API indisponível</span>
            </div>
          )}

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
