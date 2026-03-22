import { notFound } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function CartDemoPage() {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const cartModule = await import("./page.demo");
  const CartDemo = cartModule.default;

  return <CartDemo />;
}
