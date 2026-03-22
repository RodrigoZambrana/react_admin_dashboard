import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

import RegisterClient from "./RegisterClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Crear cuenta",
    description: "Crea tu cuenta para administrar pedidos, direcciones y listas personalizadas."
  });
}

export default function AccountRegisterPage() {
  return <RegisterClient />;
}
