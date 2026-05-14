import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import Layout1 from "@/components/layout/layout-1";
import RegisterClient from "./RegisterClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Crear cuenta",
    description: "Creá tu cuenta con correo o teléfono para continuar en la tienda.",
  });
}

export default function AccountRegisterPage() {
  return (
    <Layout1>
      <RegisterClient />
    </Layout1>
  );
}
