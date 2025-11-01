"use client";

import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export interface NetworkStatusBannerProps {
  reconnectMessage?: string;
  offlineMessage?: string;
}

export function NetworkStatusBanner({
  reconnectMessage = "Conectado nuevamente. Actualizamos la información.",
  offlineMessage = "Sin conexión. Reintentaremos automáticamente.",
}: NetworkStatusBannerProps) {
  const { isOnline } = useNetworkStatus();
  const [showReconnect, setShowReconnect] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setShowReconnect(true);
      const timer = window.setTimeout(() => setShowReconnect(false), 3500);
      return () => window.clearTimeout(timer);
    }
    setShowReconnect(false);
    return undefined;
  }, [isOnline]);

  if (isOnline && !showReconnect) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: "280px",
        maxWidth: "90vw",
        borderRadius: "999px",
        padding: "12px 20px",
        fontSize: "14px",
        fontWeight: 500,
        color: isOnline ? "#047857" : "#92400e",
        background: isOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(251, 191, 36, 0.25)",
        border: `1px solid ${isOnline ? "rgba(5, 150, 105, 0.25)" : "rgba(180, 83, 9, 0.35)"}`,
        backdropFilter: "blur(6px)",
        zIndex: 1000,
      }}
    >
      {isOnline ? reconnectMessage : offlineMessage}
    </div>
  );
}

export default NetworkStatusBanner;
