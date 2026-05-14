import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import Layout1 from "@/components/layout/layout-1";
import ForgotPasswordPageClient from "./ForgotPasswordPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Restablecer contraseña",
    description: "Solicita un enlace seguro para definir una nueva contraseña."
  });
}

export default function ForgotPasswordPage() {
  return (
    <Layout1>
      <ForgotPasswordPageClient />
    </Layout1>
  );
}
