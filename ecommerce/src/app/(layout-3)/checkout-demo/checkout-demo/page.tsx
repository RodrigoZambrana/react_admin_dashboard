import { notFound } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function CheckoutDemoPage() {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const checkoutModule = await import("./page.demo");
  const CheckoutDemo = checkoutModule.default;

  return <CheckoutDemo />;
}
