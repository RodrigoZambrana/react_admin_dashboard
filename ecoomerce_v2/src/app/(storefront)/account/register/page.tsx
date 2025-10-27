import type { Metadata } from "next";

import RegisterClient from "./RegisterClient";

export const metadata: Metadata = {
  title: "Create account · Storefront",
  description: "Join the storefront community to track orders, addresses, and exclusive offers."
};

export default function AccountRegisterPage() {
  return <RegisterClient />;
}

