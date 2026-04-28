import { PropsWithChildren } from "react";
import { notFound } from "next/navigation";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { isDemoRouteEnabled } from "@/lib/public-route-policy";
import { StorefrontSessionProvider } from "@/state/session-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";
import { WishlistProvider } from "@/state/wishlist-context";
import DeferredWebchatRoot from "@/components/ai-chat/DeferredWebchatRoot";

import { StorefrontConfigProvider } from "../(storefront)/storefront-context";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: PropsWithChildren) {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const config = await getStorefrontConfig();
  const layoutModule = await import("@component/layout/layout-3");
  const AppLayout = layoutModule.default;

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
