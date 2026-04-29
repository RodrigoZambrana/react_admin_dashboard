import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import RegisterClient from "./register-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Crear cuenta con teléfono",
    description: "Regístrate con tu teléfono y valida tu cuenta mediante OTP por SMS.",
  });
}

export default function Page() {
  return <RegisterClient />;
}

