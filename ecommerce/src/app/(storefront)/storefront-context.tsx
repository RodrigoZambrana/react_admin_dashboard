"use client";

import { createContext, useContext, useEffect } from "react";

import type { StorefrontConfig } from "@/types/storefront";
import { setSnapshotFallbackEnabled } from "@/lib/resilience-flags";

const StorefrontConfigContext = createContext<StorefrontConfig | null>(null);

export const StorefrontConfigProvider: React.FC<{
  config: StorefrontConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  useEffect(() => {
    setSnapshotFallbackEnabled(config.resilience?.snapshotFallbackEnabled !== false);
  }, [config.resilience?.snapshotFallbackEnabled]);

  return (
    <StorefrontConfigContext.Provider value={config}>{children}</StorefrontConfigContext.Provider>
  );
};

export const useStorefrontConfig = () => {
  const context = useContext(StorefrontConfigContext);
  if (!context) {
    throw new Error("useStorefrontConfig must be used within a StorefrontConfigProvider");
  }
  return context;
};
