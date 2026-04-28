import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Buscar",
    description: "La búsqueda redirige al listado público de la tienda.",
    canonicalPath: "/shop",
    noIndex: true,
  });
}

export default function SearchPage() {
  redirect("/shop");
}
