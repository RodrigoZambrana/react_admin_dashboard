import { PropsWithChildren } from "react";

import { getStorefrontConfig } from "@/lib/storefront-config";
import { StorefrontSessionProvider } from "@/state/session-context";
import AppLayout from "@component/layout/layout-3";

import { StorefrontConfigProvider } from "../(storefront)/storefront-context";

export default async function Layout({ children }: PropsWithChildren) {
  const config = await getStorefrontConfig();

  return (
    <StorefrontConfigProvider config={config}>
      <StorefrontSessionProvider>
        <AppLayout>{children}</AppLayout>
      </StorefrontSessionProvider>
    </StorefrontConfigProvider>
  );
}
