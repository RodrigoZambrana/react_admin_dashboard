import { PropsWithChildren } from "react";
import AppLayout from "@component/layout/layout-3";

import { StorefrontSessionProvider } from "@/state/session-context";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <StorefrontSessionProvider>
      <AppLayout>{children}</AppLayout>
    </StorefrontSessionProvider>
  );
}
