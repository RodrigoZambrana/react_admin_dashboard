import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import ContactPageClient from "./ContactPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Contacto",
    description: "Canales de contacto y atención del storefront."
  });
}

export default function ContactPage() {
  return <ContactPageClient />;
}
