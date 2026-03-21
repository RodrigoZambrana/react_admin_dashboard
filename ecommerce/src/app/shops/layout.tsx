import { PropsWithChildren } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { enforcePublicRoute } from "@/lib/public-route-policy";
import { StorefrontSessionProvider } from "@/state/session-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";
import { WishlistProvider } from "@/state/wishlist-context";
import AppLayout from "@component/layout/layout-3";

import { StorefrontConfigProvider } from "../(storefront)/storefront-context";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: PropsWithChildren) {
  enforcePublicRoute("shops");

  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <StorefrontCurrencyProvider>
          <WishlistProvider>
            <AppLayout>{children}</AppLayout>
          </WishlistProvider>
        </StorefrontCurrencyProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
