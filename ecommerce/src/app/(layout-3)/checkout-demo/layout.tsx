import type { PropsWithChildren } from "react";
import { notFound } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: PropsWithChildren) {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const layoutModule = await import("./CheckoutDemoLayoutClient");
  const CheckoutDemoLayoutClient = layoutModule.default;

  return <CheckoutDemoLayoutClient>{children}</CheckoutDemoLayoutClient>;
}
