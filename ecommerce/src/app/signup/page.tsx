import { redirect } from "next/navigation";

import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (!isDemoRouteEnabled()) {
    redirect("/account/register");
  }

  const signupModule = await import("@sections/auth/Signup");
  const Signup = signupModule.default;

  return <Signup />;
}
