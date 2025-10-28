import { PropsWithChildren } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontSessionProvider } from "@/state/session-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";
import { WishlistProvider } from "@/state/wishlist-context";
import AppLayout from "@component/layout/layout-3";
import { GoogleAuthDebugPanel } from "@/components/debug/GoogleAuthDebugPanel";

import { StorefrontConfigProvider } from "../(storefront)/storefront-context";

export default async function Layout({ children }: PropsWithChildren) {
  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <StorefrontCurrencyProvider>
          <WishlistProvider>
            <AppLayout>{children}</AppLayout>
            <GoogleAuthDebugPanel />
          </WishlistProvider>
        </StorefrontCurrencyProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
