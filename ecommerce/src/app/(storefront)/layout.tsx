import type { ReactNode } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontSessionProvider } from "@/state/session-context";
import { WishlistProvider } from "@/state/wishlist-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";
import { GoogleAuthDebugPanel } from "@/components/debug/GoogleAuthDebugPanel";

import { StorefrontConfigProvider } from "./storefront-context";

type StorefrontLayoutProps = {
  children: ReactNode;
};

export default async function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <StorefrontCurrencyProvider>
          <WishlistProvider>
            {children}
            <GoogleAuthDebugPanel />
          </WishlistProvider>
        </StorefrontCurrencyProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
