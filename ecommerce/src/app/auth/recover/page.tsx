import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import RecoverClient from "./recover-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Recuperar cuenta",
    description: "Recupera el acceso por SMS o email según el método disponible.",
  });
}

export default function Page() {
  return <RecoverClient />;
}

