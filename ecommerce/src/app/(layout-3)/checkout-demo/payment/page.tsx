import { notFound } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function CheckoutDemoPaymentPage() {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const paymentModule = await import("./page.demo");
  const PaymentDemo = paymentModule.default;

  return <PaymentDemo />;
}
