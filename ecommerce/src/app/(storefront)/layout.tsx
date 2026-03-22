import type { ReactNode } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontSessionProvider } from "@/state/session-context";
import { WishlistProvider } from "@/state/wishlist-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";

import { StorefrontConfigProvider } from "./storefront-context";

type StorefrontLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const config = await getStorefrontConfig();
  const clientConfig = {
    ...config,
    layouts: [],
    policies: [],
  };

  return (
    <StorefrontConfigProvider config={clientConfig}>
      <StorefrontSessionProvider>
        <StorefrontCurrencyProvider>
          <WishlistProvider>{children}</WishlistProvider>
        </StorefrontCurrencyProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
