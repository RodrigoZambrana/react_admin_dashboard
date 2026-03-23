"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card1 } from "@component/Card1";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";
import { Button } from "@component/buttons";

import { useCheckoutTotals } from "@/hooks/useCheckoutTotals";
import { useCurrency } from "@/state/currency-context";
import { useTranslation } from "@/state/i18n-context";
import type { CheckoutSummary } from "@/types/storefront";

type CheckoutCostSummaryProps = {
  actionHref?: string | null;
  actionLabel?: string;
  summaryOverride?: CheckoutSummary | null;
};

export default function CheckoutCostSummary({
  actionHref = "/checkout",
  actionLabel,
  summaryOverride = null
}: CheckoutCostSummaryProps) {
  const { totals } = useCheckoutTotals();
  const { formatMoney, convertMoney } = useCurrency();
  const t = useTranslation();

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
        <Link href={actionHref}>
          <Button variant="contained" color="primary" fullWidth>
            {actionLabel ?? t("checkout.summary.primaryAction", { defaultMessage: "Checkout Now" })}
          </Button>
        </Link>
      )}
    </Card1>
  );
}
