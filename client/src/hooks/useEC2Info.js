// ============================================================
// hooks/useEC2Info.js
// Hook customizado para buscar e atualizar dados da instância
// EC2 que está servindo a aplicação no momento.
//
// Atualiza a cada 30s para refletir mudanças de instância
// quando há múltiplas EC2 atrás de um Load Balancer.
// ============================================================

import { useState, useEffect, useCallback } from "react";

const REFRESH_INTERVAL_MS = 30000; // 30 segundos

const useEC2Info = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true); // ← bug corrigido (era `= true` inválido)
  const [error, setError] = useState(null);

  // useCallback garante que a função não seja recriada a cada render,
  // evitando loop infinito no useEffect
  const fetchInstanceInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/instance-info");

      if (!response.ok) {
        throw new Error(`Servidor retornou status ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Busca imediata ao montar
    fetchInstanceInfo();

    // Polling a cada 30s para detectar troca de instância pelo ALB
    const interval = setInterval(fetchInstanceInfo, REFRESH_INTERVAL_MS);

    // Cleanup: limpa o intervalo ao desmontar o componente
    return () => clearInterval(interval);
  }, [fetchInstanceInfo]);

  return { data, loading, error, refetch: fetchInstanceInfo };
};

export default useEC2Info;
