import React, { useState, useEffect } from 'react';

// EC2Info — Identifica qual instância EC2 está servindo a página
// Usa window.__EC2_INFO__ injetado pelo servidor (estratégia para cluster)
// Fallback: fetch direto quando não há dados injetados (dev local)

const EC2Info = () => {
  const [instanceData, setInstanceData] = useState(null);
  const [status, setStatus]             = useState('loading');
  const [showDetails, setShowDetails]   = useState(false);

  const loadData = async (isRefresh = false) => {
    setStatus('loading');
    try {
      // Prioridade 1: dados injetados no HTML pelo Express (correto em cluster)
      if (window.__EC2_INFO__ && !isRefresh) {
        setInstanceData(window.__EC2_INFO__);
        setStatus('success');
        return;
      }

      // Prioridade 2: fetch direto (dev local ou refresh manual)
      // Usa window.location.origin — mesma origem, porta correta automaticamente
      const response = await fetch(`${window.location.origin}/api/instance-infos`, {
        method: 'GET',
        cache: 'no-cache',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      window.__EC2_INFO__ = data;
      setInstanceData(data);
      setStatus('success');

    } catch (error) {
      console.warn('[EC2Info] Falha:', error.message);
      setStatus('error');
    }
  };

  useEffect(() => { loadData(); }, []);

  const getStatusIcon = () => {
    if (status === 'success') return '🟢';
    if (status === 'error')   return '🔴';
    return '🟡';
  };

  const getShortId = () => {
    if (!instanceData?.instanceId) return 'EC2';
    const id = instanceData.instanceId;
    if (id === 'local-dev' || id === 'localhost') return 'Local';
    return id.length > 13 ? `${id.slice(0, 9)}...${id.slice(-4)}` : id;
  };

  return (
    <div className="ec2-info-wrapper">
      <button
        className={`ec2-trigger ${status}`}
        onClick={() => setShowDetails(!showDetails)}
        title="Informações desta instância EC2"
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
