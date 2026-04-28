import { useEffect, useState } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  lastChangedAt: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetworkStatus>(() => ({
    isOnline: true,
    lastChangedAt: 0,
  }));

  useEffect(() => {
    const syncCurrentStatus = () =>
      setState({
        isOnline: navigator.onLine,
        lastChangedAt: Date.now(),
      });

    syncCurrentStatus();

    const handleOnline = () =>
      setState({
        isOnline: true,
        lastChangedAt: Date.now(),
      });
    const handleOffline = () =>
      setState({
        isOnline: false,
        lastChangedAt: Date.now(),
      });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return state;
}
