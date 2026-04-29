import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import VerifyPhoneClient from "./verify-phone-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Validar teléfono",
    description: "Ingresa el OTP enviado por SMS para activar la cuenta.",
  });
}

export default function Page() {
  return <VerifyPhoneClient />;
}

