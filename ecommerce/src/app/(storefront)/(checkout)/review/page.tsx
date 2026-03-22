import type { Metadata } from "next";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Revisión del pedido",
    description: "Verifica el resumen de tu compra antes de confirmar el pedido."
  });
}

import ReviewClient from "./ReviewClient";

export default function ReviewPage() {
  return <ReviewClient />;
}
