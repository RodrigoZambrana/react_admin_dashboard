import type { PropsWithChildren } from "react";
import { enforcePublicRoute } from "@/lib/public-route-policy";
import AppLayout from "@component/layout/layout-1";
import Navbar from "@component/navbar/Navbar";

export const dynamic = "force-dynamic";

export default function Layout({ children }: PropsWithChildren) {
  enforcePublicRoute("market1");

  return <AppLayout navbar={<Navbar navListOpen />}>{children}</AppLayout>;
}
