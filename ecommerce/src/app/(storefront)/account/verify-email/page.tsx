import type { Metadata } from "next";
import { Suspense } from "react";

import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import Layout1 from "@/components/layout/layout-1";
import VerifyEmailPageClient from "./VerifyEmailPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Verificar correo electrónico",
    description: "Confirma tu correo para activar las comunicaciones de tu cuenta.",
  });
}

export default function VerifyEmailPage() {
  return (
    <Layout1>
      <Suspense fallback={null}>
        <VerifyEmailPageClient />
      </Suspense>
    </Layout1>
  );
}
