"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { Card1 } from "@component/Card1";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";
import { Button } from "@component/buttons";

import { useCheckoutTotals } from "@/hooks/useCheckoutTotals";
import { useCurrency } from "@/state/currency-context";
import { useTranslation } from "@/state/i18n-context";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useStorefrontCart } from "@/state/cart-context";
import { buildCanonicalAnalyticsContext } from "@/lib/analytics/product-context";
import type { CheckoutSummary } from "@/types/storefront";

type CheckoutCostSummaryProps = {
  actionHref?: string | null;
  actionLabel?: string;
  summaryOverride?: CheckoutSummary | null;
  pageType?: string;
};

export default function CheckoutCostSummary({
  actionHref = "/checkout",
  actionLabel,
  summaryOverride = null,
  pageType: pageTypeProp
}: CheckoutCostSummaryProps) {
  const { totals } = useCheckoutTotals();
  const { state: cartState } = useStorefrontCart();
  const { formatMoney, convertMoney } = useCurrency();
  const t = useTranslation();
  const pathname = usePathname();
  const pageType = pageTypeProp ?? resolvePageType(pathname);

  const hasTax = summaryOverride ? summaryOverride.tax.amount > 0 : totals.taxRate > 0;
  const subtotalLabel = hasTax
    ? t("checkout.summary.subtotalExcludingTax", { defaultMessage: "Subtotal (excluding taxes)" })
    : t("checkout.review.summary.subtotal", { defaultMessage: "Subtotal" });
  const taxLabel = hasTax
    ? summaryOverride
      ? t("checkout.summary.tax", { defaultMessage: "Taxes" })
      : t("checkout.summary.taxWithRate", {
          defaultMessage: "Taxes ({rate}%)",
          values: { rate: totals.taxRate.toFixed(2) }
        })
    : t("checkout.summary.tax", { defaultMessage: "Taxes" });
  const totalLabel = hasTax
    ? t("checkout.summary.totalIncludingTax", { defaultMessage: "Total (including taxes)" })
    : t("checkout.review.summary.total", { defaultMessage: "Total" });

  const rows = useMemo(
    () => [
      {
        label: subtotalLabel,
        value: summaryOverride ? summaryOverride.subtotal : totals.subtotal
      },
      {
        label: t("checkout.review.summary.shipping", { defaultMessage: "Shipping" }),
        value: summaryOverride ? summaryOverride.shipping : totals.shipping
      },
      { label: taxLabel, value: summaryOverride ? summaryOverride.tax : totals.tax },
      {
        label: t("checkout.review.summary.discount", { defaultMessage: "Discount" }),
        value: totals.discount
      }
    ],
    [subtotalLabel, summaryOverride, t, taxLabel, totals]
  );

  const hasAction = Boolean(actionHref);
  const totalValue = summaryOverride ? summaryOverride.grandTotal : totals.total;

  return (
    <Card1>
      {rows.map((row) => (
        <FlexBox key={row.label} justifyContent="space-between" alignItems="center" mb="0.75rem">
          <Typography color="text.hint">{row.label}:</Typography>
          <Typography fontSize="18px" fontWeight="600" lineHeight="1">
            {formatMoney(convertMoney(row.value))}
          </Typography>
        </FlexBox>
      ))}

      <Divider mb="1rem" />

      <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
        <Typography fontWeight="600">{totalLabel}</Typography>
        <Typography fontSize="24px" fontWeight="700" lineHeight="1">
          {formatMoney(convertMoney(totalValue))}
        </Typography>
      </FlexBox>

      {hasTax && !summaryOverride && (
        <Typography color="text.muted" fontSize="12px" textAlign="right" mb={hasAction ? "1rem" : undefined}>
          {t("checkout.summary.taxApplied", {
            defaultMessage: "Applied tax: {rate}%",
            values: { rate: totals.taxRate.toFixed(2) }
          })}
          {totals.taxId
            ? ` · ${t("checkout.summary.taxId", {
                defaultMessage: "Tax ID {taxId}",
                values: { taxId: totals.taxId }
              })}`
            : ""}
        </Typography>
      )}

      {!hasTax && !summaryOverride && totals.taxId && (
        <Typography color="text.muted" fontSize="12px" textAlign="right" mb={hasAction ? "1rem" : undefined}>
          {t("checkout.summary.taxId", {
            defaultMessage: "Tax ID {taxId}",
            values: { taxId: totals.taxId }
          })}
        </Typography>
      )}

      {hasAction && actionHref && (
        <Link
          href={actionHref}
          data-testid="checkout-continue-to-payment"
          onClick={() => {
            void trackEvent({
              event_name: "begin_checkout",
              event_category: "conversion",
              tenant_id: env.clientSlug,
              page_type: pageType,
              component_type: "cart_summary",
              component_id: "cart_checkout_summary",
              cta_id: "checkout.continue_to_payment",
              cta_name: "begin_checkout",
              cta_type: "primary",
              cta_context: "checkout",
              cta_location: "cart_summary",
              schema_version: EVENT_SCHEMA_VERSION,
              metadata: {
                cart_value: summaryOverride ? summaryOverride.grandTotal.amount : totals.total.amount,
                currency: summaryOverride ? summaryOverride.grandTotal.currency : totals.total.currency,
                items: cartState.items.map(({ product, quantity }) => ({
                  ...product,
                  quantity,
                  ...buildCanonicalAnalyticsContext({
                    canonicalConfiguration: product.canonicalConfiguration ?? null,
                    configuration: product.configuration ?? null
                  })
                })),
              },
              data: {
                cart_value: summaryOverride ? summaryOverride.grandTotal.amount : totals.total.amount,
                currency: summaryOverride ? summaryOverride.grandTotal.currency : totals.total.currency,
                items: cartState.items.map(({ product, quantity }) => ({
                  ...product,
                  quantity,
                  ...buildCanonicalAnalyticsContext({
                    canonicalConfiguration: product.canonicalConfiguration ?? null,
                    configuration: product.configuration ?? null
                  })
                })),
              },
            });
          }}>
          <Button variant="contained" color="primary" fullWidth>
            {actionLabel ?? t("checkout.summary.primaryAction", { defaultMessage: "Checkout Now" })}
          </Button>
        </Link>
      )}
    </Card1>
  );
}
