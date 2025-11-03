"use client";

import { useMemo } from "react";

import Link from "next/link";

import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import type { PaginatedResponse, ProductSummary } from "@/types/storefront";
import type { StorefrontSnapshot } from "@/lib/snapshots/types";
import { InlineNotice } from "@/components/status/InlineNotice";
import SkeletonPanel from "@/components/status/SkeletonPanel";
import PanelBoundary from "@/components/status/PanelBoundary";
import { createApiPanelRequest, usePanelResource } from "@/hooks/usePanelResource";

type FeaturedProductsPayload = PaginatedResponse<ProductSummary>;

const requestFeaturedProducts = createApiPanelRequest<FeaturedProductsPayload>(
  "products?limit=8&sort=newest"
);

export function FeaturedProductsPanel() {
  const config = useStorefrontConfig();
  const snapshotEnabled = config.resilience?.snapshotFallbackEnabled !== false;

  const { data, error, status, isRefreshing, isStale, refetch, source, snapshotAt } =
    usePanelResource({
      cacheKey: "panel.featured-products",
      request: requestFeaturedProducts,
      staleMs: 5 * 60_000,
      snapshotEnabled,
      snapshotSelector: (snapshot: StorefrontSnapshot): FeaturedProductsPayload | null => {
        const items = snapshot.products.newest?.slice(0, 8) ?? [];
        if (!items.length) {
          return null;
        }
        return {
          data: items,
          total: items.length,
          page: 1,
          pageSize: items.length,
          totalPages: 1,
        };
      },
    });

  const items = useMemo(() => data?.data ?? [], [data]);

  if (status === "loading" && !items.length) {
    return <SkeletonPanel lines={4} height={10} />;
  }

  if (!items.length && status === "error") {
    return (
      <div style={{ padding: 20, border: "1px dashed rgba(248, 113, 113, 0.6)", borderRadius: 12 }}>
        <InlineNotice tone="warning" text="No pudimos cargar los productos destacados." />
        <button
          type="button"
          onClick={() => refetch()}
          style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid rgba(37, 99, 235, 0.4)",
            background: "#eff6ff",
            color: "#1d4ed8",
            fontWeight: 500,
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(226,232,240,0.7)",
        background: "rgba(248,250,252,0.7)",
        padding: 24,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Novedades</h2>
        <Link href="/products?sort=newest" style={{ fontSize: 14, color: "#1d4ed8" }}>
          Ver todo
        </Link>
      </header>

      {isStale || isRefreshing || error ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isStale && !isRefreshing ? (
            <InlineNotice
              tone="info"
              text={
                source === "snapshot" && snapshotAt
                  ? `Mostrando datos guardados (${new Date(snapshotAt).toLocaleString()}).`
                  : "Mostrando datos guardados."
              }
            />
          ) : null}
          {isRefreshing ? <InlineNotice tone="info" text="Actualizando…" /> : null}
          {error ? <InlineNotice tone="warning" text="Servicio intermitente. Reintentaremos pronto." /> : null}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 20,
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        {items.map((item) => (
          <article
            key={item.id}
            style={{
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(229, 231, 235, 0.8)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{item.name}</h3>
            <p style={{ fontSize: 13, color: "#475569" }}>
              {item.shortDescription ?? "Descripción no disponible."}
            </p>
            <strong style={{ fontSize: "1rem", color: "#0f172a" }}>
              {Intl.NumberFormat("es-UY", {
                style: "currency",
                currency: item.price.currency ?? "USD",
              }).format(item.price.amount ?? 0)}
            </strong>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function FeaturedProductsPanelBoundary() {
  return (
    <PanelBoundary>
      <FeaturedProductsPanel />
    </PanelBoundary>
  );
}
