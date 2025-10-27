import type { PropsWithChildren } from "react";
import AppLayout from "@component/layout/layout-1";
import Navbar from "@component/navbar/Navbar";
export default function Layout({ children }: PropsWithChildren) {
  return <AppLayout navbar={<Navbar />}>{children}</AppLayout>;
}
