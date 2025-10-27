import { PropsWithChildren } from "react";
import CustomerDashboardLayout from "@component/layout/customer-dashboard";
import StorefrontGuard from "@component/storefront/StorefrontGuard";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <StorefrontGuard>
      <CustomerDashboardLayout>{children}</CustomerDashboardLayout>
    </StorefrontGuard>
  );
}
