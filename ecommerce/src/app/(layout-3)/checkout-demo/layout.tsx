import type { PropsWithChildren } from "react";

import { enforcePublicRoute } from "@/lib/public-route-policy";
import CheckoutDemoLayoutClient from "./CheckoutDemoLayoutClient";

export const dynamic = "force-dynamic";

export default function Layout({ children }: PropsWithChildren) {
  enforcePublicRoute("checkoutDemo");

  return <CheckoutDemoLayoutClient>{children}</CheckoutDemoLayoutClient>;
}
