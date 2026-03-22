import { redirect } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export { generateMetadata } from "../page";

export default async function Market1Page() {
  if (!isDemoRouteEnabled()) {
    redirect("/");
  }

  const marketPageModule = await import("../page");
  const MarketHomePage = marketPageModule.default;

  return <MarketHomePage />;
}
