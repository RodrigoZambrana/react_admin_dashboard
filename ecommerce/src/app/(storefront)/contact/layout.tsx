import type { PropsWithChildren } from "react";

import ShopLayout from "@component/layout/layout-1";
import Navbar from "@component/navbar/Navbar";

export const dynamic = "force-dynamic";

export default function ContactLayout({ children }: PropsWithChildren) {
  return <ShopLayout navbar={<Navbar />}>{children}</ShopLayout>;
}
