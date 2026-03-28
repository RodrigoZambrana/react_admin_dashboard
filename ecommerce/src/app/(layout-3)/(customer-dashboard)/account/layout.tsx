import type { PropsWithChildren } from "react";
import CustomerDashboardLayout from "@component/layout/customer-dashboard";
import StorefrontGuard from "@component/storefront/StorefrontGuard";

export const dynamic = "force-dynamic";

export default function AccountLayout({ children }: PropsWithChildren) {
  return (
    <StorefrontGuard>
      <CustomerDashboardLayout>{children}</CustomerDashboardLayout>
    </StorefrontGuard>
  );
}
