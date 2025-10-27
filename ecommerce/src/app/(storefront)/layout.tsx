import type { ReactNode } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontSessionProvider } from "@/state/session-context";

import { StorefrontConfigProvider } from "./storefront-context";

type StorefrontLayoutProps = {
  children: ReactNode;
};

export default async function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>{children}</StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
