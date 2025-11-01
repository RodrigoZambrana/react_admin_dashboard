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

type CheckoutCostSummaryProps = {
  actionHref?: string | null;
  actionLabel?: string;
};

export default function CheckoutCostSummary({
  actionHref = "/checkout",
  actionLabel = "Checkout Now"
}: CheckoutCostSummaryProps) {
  const { totals } = useCheckoutTotals();
  const { formatMoney, convertMoney } = useCurrency();

  const hasTax = totals.taxRate > 0;
  const subtotalLabel = hasTax ? "Subtotal (sin impuestos)" : "Subtotal";
  const taxLabel = hasTax ? `Impuestos (${totals.taxRate.toFixed(2)}%)` : "Impuestos";
  const totalLabel = hasTax ? "Total (con impuestos)" : "Total";

  const rows = useMemo(
    () => [
      { label: subtotalLabel, value: totals.subtotal },
      { label: "Shipping", value: totals.shipping },
      { label: taxLabel, value: totals.tax },
      { label: "Discount", value: totals.discount }
    ],
    [subtotalLabel, taxLabel, totals]
  );

  const hasAction = Boolean(actionHref);

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
          {formatMoney(convertMoney(totals.total))}
        </Typography>
      </FlexBox>

      {hasTax && (
        <Typography color="text.muted" fontSize="12px" textAlign="right" mb={hasAction ? "1rem" : undefined}>
          Impuesto aplicado: {totals.taxRate.toFixed(2)}%
          {totals.taxId ? ` · Tax ID ${totals.taxId}` : ""}
        </Typography>
      )}

      {!hasTax && totals.taxId && (
        <Typography color="text.muted" fontSize="12px" textAlign="right" mb={hasAction ? "1rem" : undefined}>
          Tax ID {totals.taxId}
        </Typography>
      )}

      {hasAction && actionHref && (
        <Link href={actionHref}>
          <Button variant="contained" color="primary" fullWidth>
            {actionLabel ?? "Continue"}
          </Button>
        </Link>
      )}
    </Card1>
  );
}
