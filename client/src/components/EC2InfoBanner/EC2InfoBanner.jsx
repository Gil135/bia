// ============================================================
// components/EC2InfoBanner/EC2InfoBanner.jsx
//
// Banner fixo no topo da página que exibe os dados da instância
// EC2 que está atendendo a requisição atual.
// Útil para demonstrar o ALB: ao recarregar, o Instance ID
// pode mudar, mostrando outra instância assumindo o tráfego.
// ============================================================

import React from "react";
import useEC2Info from "../../hooks/useEC2Info";
import styles from "./EC2InfoBanner.module.css";

// Sub-componente: item individual de informação
const InfoItem = ({ label, value }) => (
  <div className={styles.infoItem}>
    <span className={styles.infoLabel}>{label}</span>
    <span className={styles.infoValue}>{value || "N/A"}</span>
  </div>
);

// Sub-componente: animação de loading (skeleton)

const BannerSkeleton = () => (
  <div className={styles.banner}>
    <div className={styles.skeletonWrapper}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={styles.skeletonItem} />
      ))}
    </div>
  </div>
);

// Componente principal
const EC2InfoBanner = () => {
  const { data, loading, error } = useEC2Info();

  if (loading) return <BannerSkeleton />;

  if (error) {
    return (
      <div className={`${styles.banner} ${styles.bannerError}`}>
        <span>⚠️ Não foi possível carregar informações da instância</span>
      </div>
    );
  }

  // 1. AVALIA O AMBIENTE
// Se data.isAWS for true, ou se o instanceId começar com "i-" (padrão da AWS)
const isEC2 = data?.isAWS === true || (data?.instanceId && data?.instanceId.startsWith('i-'));

// 2. DEFINE PROPRIEDADES VISUAIS DINÂMICAS BASEADAS NO AMBIENTE
const ambienteTexto = isEC2 ? "Nuvem AWS (EC2)" : "Ambiente Local";
const iconeAmbiente = isEC2 ? "☁️" : "💻";
const classeCor = isEC2 ? "banner-aws" : "banner-local"; // Você pode criar essas classes no seu CSS

return (
  <div className={`ec2-banner-container ${classeCor}`}>
    <div className="ec2-banner-header">
      {/* Exibindo o tipo de ambiente de forma dinâmica */}
      <span className="ambiente-badge">
        {iconeAmbiente} Ambiente: <strong>{ambienteTexto}</strong>
      </span>
    </div>
    
    <div className="ec2-banner-details">
      <p><strong>ID da Instância:</strong> {data?.instanceId || 'N/A'}</p>
      <p><strong>IP Privado:</strong> {data?.localIp || 'N/A'}</p>
      <p><strong>IP Público:</strong> {data?.publicIp || 'N/A'}</p>
      {/* Exibe a zona de disponibilidade apenas se for AWS */}
      {isEC2 && (
        <p><strong>Zona (AZ):</strong> {data?.region|| 'N/A'}</p>
        <p><strong>Região:</strong> {data?.availabilityZone || 'N/A'}</p>        
      )}
    </div>
  </div>
);

};

export default EC2InfoBanner;
