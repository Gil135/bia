// ============================================================
// components/EC2InfoBanner/EC2InfoBanner.jsx
//
// Banner fixo no topo da página que exibe os dados da instância
// EC2 que está atendendo a requisição atual.
// Útil para demonstrar o funcionamento do Load Balancer:
// ao recarregar, pode-se ver outra instância assumindo.
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

// Sub-componente: Skeleton de loading
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

  // Detecta EC2 real pelo instanceId (não é 'localhost')
  const isEC2 = data?.instanceId && data.instanceId !== "localhost";

  // Deriva a região a partir da AZ: "us-east-1a" → "us-east-1"
  const region = data?.availabilityZone
    ? data.availabilityZone.slice(0, -1)
    : "N/A";

  return (
    <div className={styles.banner}>
      <div className={styles.bannerTitle}>
        <span className={styles.serverIcon}>🖥️</span>
        <span className={styles.titleText}>Instância Ativa</span>
      </div>

      <div className={styles.infoGrid}>
        <InfoItem label="Instance ID" value={data?.instanceId} />
        <InfoItem label="Tipo"        value={data?.instanceType} />
        <InfoItem label="AZ"          value={data?.availabilityZone} />
        <InfoItem label="Região"      value={region} />
        <InfoItem label="IP Privado"  value={data?.localIp} />
        <InfoItem label="IP Público"  value={data?.publicIp} />
      </div>

      <div className={`${styles.badge} ${isEC2 ? styles.badgeEC2 : styles.badgeLocal}`}>
        {isEC2 ? "✅ EC2 AWS" : "🟡 Local Dev"}
      </div>
    </div>
  );
};

export default EC2InfoBanner;
