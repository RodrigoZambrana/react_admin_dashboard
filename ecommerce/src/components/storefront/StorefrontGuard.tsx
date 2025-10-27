"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import FlexBox from "@component/FlexBox";
import Spinner from "@component/Spinner";
import Typography from "@component/Typography";

import { useSession } from "@/state/session-context";

interface StorefrontGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  loadingMessage?: string;
}

export default function StorefrontGuard({
  children,
  redirectTo = "/account/login",
  loadingMessage = "Authenticating..."
}: StorefrontGuardProps) {
  const { status, isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      const params = new URLSearchParams();
      if (pathname && pathname !== redirectTo) {
        params.set("redirect", pathname);
      }
      const target = params.size > 0 ? `${redirectTo}?${params.toString()}` : redirectTo;
      router.replace(target);
    }
  }, [status, pathname, redirectTo, router]);

  if (status === "loading") {
    return (
      <FlexBox minHeight="50vh" flexDirection="column" alignItems="center" justifyContent="center">
        <Spinner />
        <Typography mt="1rem" fontSize="14px" color="text.muted">
          {loadingMessage}
        </Typography>
      </FlexBox>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

