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
import { useI18n, useTranslation } from "@/state/i18n-context";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";

type FeaturedProductsPayload = PaginatedResponse<ProductSummary>;

const requestFeaturedProducts = createApiPanelRequest<FeaturedProductsPayload>(
  "products?limit=8&sort=newest"
);

export function FeaturedProductsPanel() {
  const config = useStorefrontConfig();
  const { locale } = useI18n();
  const t = useTranslation();
  const { formatMoney } = useMoneyFormatter();
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
        <InlineNotice
          tone="warning"
          text={t("home.featured.error", {
            defaultMessage: "We couldn't load the featured products."
          })}
        />
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
          {t("account.orders.retry", { defaultMessage: "Try again" })}
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
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          {t("home.featured.title", { defaultMessage: "New arrivals" })}
        </h2>
        <Link href="/shop?sort=newest" style={{ fontSize: 14, color: "#1d4ed8" }}>
          {t("common.viewAll", { defaultMessage: "View all" })}
        </Link>
      </header>

      {isStale || isRefreshing || error ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isStale && !isRefreshing ? (
            <InlineNotice
              tone="info"
              text={
                source === "snapshot" && snapshotAt
                  ? t("home.featured.snapshotAt", {
                      defaultMessage: "Showing saved data ({date}).",
                      values: { date: new Date(snapshotAt).toLocaleString(locale) }
                    })
                  : t("home.featured.snapshot", {
                      defaultMessage: "Showing saved data."
                    })
              }
            />
          ) : null}
          {isRefreshing ? (
            <InlineNotice
              tone="info"
              text={t("home.featured.refreshing", { defaultMessage: "Refreshing…" })}
            />
          ) : null}
          {error ? (
            <InlineNotice
              tone="warning"
              text={t("home.featured.unstable", {
                defaultMessage: "Service is intermittent. We'll retry soon."
              })}
            />
          ) : null}
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
              {item.shortDescription ??
                t("product.shortDescription.missing", {
                  defaultMessage: "Description not available."
                })}
            </p>
            <strong style={{ fontSize: "1rem", color: "#0f172a" }}>
              {formatMoney({
                amount: item.price.amount ?? 0,
                currency: item.price.currency ?? "USD",
                formatted: item.price.formatted
              })}
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
