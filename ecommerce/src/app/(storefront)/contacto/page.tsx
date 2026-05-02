import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import ContactPageClient from "../contact/ContactPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Contacto y presupuesto",
    description: "Escribinos para cotizar, coordinar una visita o consultar por instalación y mantenimiento.",
    canonicalPath: "/contacto",
  });
}

export default function ContactPage() {
  return <ContactPageClient />;
}
