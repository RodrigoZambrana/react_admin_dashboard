import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import ResetPasswordPageClient from "./ResetPasswordPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Nueva contraseña",
    description: "Define una nueva contraseña para tu cuenta."
  });
}

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
