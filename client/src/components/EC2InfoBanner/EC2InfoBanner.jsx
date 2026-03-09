// ============================================================
// components/EC2InfoBanner/EC2InfoBanner.jsx
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

  const isEC2 = data?.source === "ec2-imds";

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
        <InfoItem label="Região"      value={data?.region} />
        <InfoItem label="IP Privado"  value={data?.privateIp} />
        <InfoItem label="Hostname"    value={data?.hostname} />
      </div>

      <div className={`${styles.badge} ${isEC2 ? styles.badgeEC2 : styles.badgeLocal}`}>
        {isEC2 ? "✅ EC2 AWS" : "🟡 Local Dev"}
      </div>
    </div>
  );
};

export default EC2InfoBanner;
