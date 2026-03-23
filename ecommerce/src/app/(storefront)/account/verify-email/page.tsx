import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import VerifyEmailPageClient from "./VerifyEmailPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Verificar correo electrónico",
    description: "Confirma el correo electrónico asociado a tu cuenta."
  });
}

export default function VerifyEmailPage() {
  return <VerifyEmailPageClient />;
}
