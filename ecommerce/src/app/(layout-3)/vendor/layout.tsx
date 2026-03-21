import { PropsWithChildren } from "react";
// GLOBAL CUSTOM COMPONENTS
import { enforcePublicRoute } from "@/lib/public-route-policy";
import VendorDashboardLayout from "@component/layout/vendor-dashboard";

export const dynamic = "force-dynamic";

export default function Layout({ children }: PropsWithChildren) {
  enforcePublicRoute("vendor");

  return <VendorDashboardLayout>{children}</VendorDashboardLayout>;
}
