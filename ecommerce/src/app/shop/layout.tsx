import type { ReactNode } from "react";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { enforcePublicRoute } from "@/lib/public-route-policy";
import { StorefrontSessionProvider } from "@/state/session-context";
import { StorefrontCurrencyProvider } from "@/state/currency-context";
import { WishlistProvider } from "@/state/wishlist-context";
import { WebchatProvider } from "@/state/webchat-context";
import WebchatRoot from "@/components/ai-chat/WebchatRoot";
import Topbar from "@component/topbar";
import { Header } from "@component/header";
import { Footer1 } from "@component/footer";
import Navbar from "@component/navbar/Navbar";
import MobileNavigationBar from "@component/mobile-navigation";
import { StorefrontConfigProvider } from "../(storefront)/storefront-context";

type ShopLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: ShopLayoutProps) {
  enforcePublicRoute("shop");

  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <StorefrontCurrencyProvider>
          <WishlistProvider>
            <WebchatProvider>
              <Topbar />
              <Header />
              <Navbar />

              {children}

              <WebchatRoot />
              <MobileNavigationBar />
              <Footer1 />
            </WebchatProvider>
          </WishlistProvider>
        </StorefrontCurrencyProvider>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
