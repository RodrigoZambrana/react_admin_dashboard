import { redirect } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isDemoRouteEnabled()) {
    redirect("/account/login");
  }

  const loginModule = await import("@sections/auth/Login");
  const Login = loginModule.default;

  return <Login />;
}
