import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import ResetPasswordClient from "./reset-password-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Restablecer contraseña",
    description: "Definí una nueva contraseña con el token o código recibido.",
  });
}

export default function Page() {
  return <ResetPasswordClient />;
}

