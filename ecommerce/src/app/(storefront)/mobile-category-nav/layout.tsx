import type { PropsWithChildren } from "react";

import { enforcePublicRoute } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default function MobileCategoryNavLayout({ children }: PropsWithChildren) {
  enforcePublicRoute("mobileCategoryNav");

  return children;
}
