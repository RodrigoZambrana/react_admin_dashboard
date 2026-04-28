import type { Metadata } from "next";

import AppLayout from "@component/layout/layout-1";
import Navbar from "@component/navbar/Navbar";
import BudgetPageContent from "@/components/budget/BudgetPageContent";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

type BudgetPageSearchParams = {
  productId?: string | string[];
  product?: string | string[];
  slug?: string | string[];
  width?: string | string[];
  height?: string | string[];
};

const coerceParam = (value?: string | string[]) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim().length > 0)?.trim() ?? null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const revalidate = 120;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Calculá tu presupuesto",
    description: "Ingresá las medidas y obtené el precio al instante.",
    canonicalPath: "/presupuesto",
  });
}

export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams?: Promise<BudgetPageSearchParams | undefined>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialProductId = Number(coerceParam(resolvedSearchParams?.productId) ?? "");
  const initialProductSlug = coerceParam(resolvedSearchParams?.product) ?? coerceParam(resolvedSearchParams?.slug);
  const initialWidth = Number(coerceParam(resolvedSearchParams?.width) ?? 1);
  const initialHeight = Number(coerceParam(resolvedSearchParams?.height) ?? 1);

  return (
    <AppLayout navbar={<Navbar />}>
      <BudgetPageContent
        title="Calculá tu presupuesto"
        description="Ingresá las medidas y obtené el precio al instante."
        initialProductId={Number.isFinite(initialProductId) && initialProductId > 0 ? initialProductId : null}
        initialProductSlug={initialProductSlug}
        initialWidth={Number.isFinite(initialWidth) && initialWidth > 0 ? initialWidth : 1}
        initialHeight={Number.isFinite(initialHeight) && initialHeight > 0 ? initialHeight : 1}
      />
    </AppLayout>
  );
}
