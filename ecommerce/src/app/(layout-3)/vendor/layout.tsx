import { PropsWithChildren } from "react";
import { notFound } from "next/navigation";
// GLOBAL CUSTOM COMPONENTS
import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: PropsWithChildren) {
  if (!isDemoRouteEnabled()) {
    notFound();
  }

  const layoutModule = await import("@component/layout/vendor-dashboard");
  const VendorDashboardLayout = layoutModule.default;

  return <VendorDashboardLayout>{children}</VendorDashboardLayout>;
}
