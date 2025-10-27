import { Suspense } from "react";
import type { Metadata } from "next";

import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in · Storefront",
  description: "Access your orders, saved addresses, and exclusive offers."
};

export default function AccountLoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "#475569" }}>
          Loading sign-in experience…
        </div>
      }>
      <LoginClient />
    </Suspense>
  );
}
