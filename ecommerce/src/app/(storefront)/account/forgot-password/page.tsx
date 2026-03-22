import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import ForgotPasswordPageClient from "./ForgotPasswordPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Restablecer contraseña",
    description: "Solicita un enlace para restablecer la contraseña de tu cuenta."
  });
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}
