import { notFound } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";
import { SlugParams } from "interfaces";

export const dynamic = "force-dynamic";

export default async function ShopDetailsPage(props: SlugParams) {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const demoModule = await import("./page.demo");
  const ShopDetailsDemoPage = demoModule.default;

  return <ShopDetailsDemoPage {...props} />;
}
