import { PropsWithChildren } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontSessionProvider } from "@/state/session-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";
import { WishlistProvider } from "@/state/wishlist-context";
import DeferredWebchatRoot from "@/components/ai-chat/DeferredWebchatRoot";
import AppLayout from "@component/layout/layout-3";

import { StorefrontConfigProvider } from "../(storefront)/storefront-context";

export default async function Layout({ children }: PropsWithChildren) {
  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <StorefrontCurrencyProvider>
          <WishlistProvider>
            <AppLayout>{children}</AppLayout>
            <DeferredWebchatRoot />
          </WishlistProvider>
        </StorefrontCurrencyProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
