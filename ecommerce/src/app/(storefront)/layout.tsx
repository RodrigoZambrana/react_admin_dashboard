import type { ReactNode } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontCartProvider } from "@/state/cart-context";
import { StorefrontSessionProvider } from "@/state/session-context";

import { StorefrontConfigProvider } from "./storefront-context";

type StorefrontLayoutProps = {
  children: ReactNode;
};

export default async function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <StorefrontCartProvider>{children}</StorefrontCartProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
