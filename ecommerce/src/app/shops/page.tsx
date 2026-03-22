import { notFound } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function ShopListPage() {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const shopsPageModule = await import("./page.demo");
  const ShopsDemoPage = shopsPageModule.default;

  return <ShopsDemoPage />;
}
