import { PropsWithChildren } from "react";
import ShopLayout from "@component/layout/layout-2";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontConfigProvider } from "@/app/(storefront)/storefront-context";
import { StorefrontSessionProvider } from "@/state/session-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";
import { WishlistProvider } from "@/state/wishlist-context";

export default async function Layout({ children }: PropsWithChildren) {
  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <StorefrontCurrencyProvider>
          <WishlistProvider>
            <ShopLayout showNavbar={false}>{children}</ShopLayout>
          </WishlistProvider>
        </StorefrontCurrencyProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
