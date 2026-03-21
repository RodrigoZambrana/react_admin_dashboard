import { PropsWithChildren } from "react";
import FlexBox from "@component/FlexBox";
import { enforcePublicRoute } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default function Layout({ children }: PropsWithChildren) {
  enforcePublicRoute("login");

  return (
    <FlexBox minHeight="100vh" alignItems="center" flexDirection="column" justifyContent="center">
      {children}
    </FlexBox>
  );
}
