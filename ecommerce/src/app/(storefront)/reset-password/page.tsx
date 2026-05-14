import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import Layout1 from "@/components/layout/layout-1";
import ResetPasswordPageClient from "./ResetPasswordPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Nueva contraseña",
    description: "Define una nueva contraseña para tu cuenta."
  });
}

export default function ResetPasswordPage() {
  return (
    <Layout1>
      <ResetPasswordPageClient />
    </Layout1>
  );
}
