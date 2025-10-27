"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card1 } from "@component/Card1";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";
import { Button } from "@component/buttons";

import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { formatMoney, normalizeMoney } from "@/lib/utils/format";
import type { Money } from "@/types/storefront";
import { useStorefrontCart } from "@/state/cart-context";

type CheckoutCostSummaryProps = {
  actionHref?: string | null;
  actionLabel?: string;
};

const parseTaxRate = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const toMoney = (amount: number, currency: string): Money =>
  normalizeMoney({ amount, currency } as Money);

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export default function CheckoutCostSummary({
  actionHref = "/checkout",
  actionLabel = "Checkout Now"
}: CheckoutCostSummaryProps) {
  const { subtotal } = useStorefrontCart();
  const config = useStorefrontConfig();

  const totals = useMemo(() => {
    const currency = subtotal.currency ?? "USD";
    const configRecord = config as Record<string, any>;
    const profileRecord = (config.companyProfile ?? {}) as Record<string, any>;

    const taxRateCandidate =
      parseTaxRate(profileRecord?.taxRate) ??
      parseTaxRate(configRecord?.taxRate) ??
      parseTaxRate(configRecord?.checkout?.taxRate) ??
      parseTaxRate(configRecord?.pricing?.taxRate);

    const taxRate = taxRateCandidate ?? 0;
    const taxAmount =
      subtotal.amount > 0 ? roundCurrency(subtotal.amount * (taxRate / 100)) : 0;

    const shippingAmount = 0;
    const discountAmount = 0;
    const totalAmount = roundCurrency(
      subtotal.amount + taxAmount + shippingAmount - discountAmount
    );

    return {
      taxRate,
      taxId: typeof profileRecord?.taxId === "string" ? profileRecord.taxId : undefined,
      subtotal: subtotal,
      shipping: toMoney(shippingAmount, currency),
      tax: toMoney(taxAmount, currency),
      discount: toMoney(discountAmount, currency),
      total: toMoney(totalAmount, currency)
    };
  }, [config, subtotal]);

  const rows: Array<{ label: string; value: Money }> = [
    { label: "Subtotal:", value: totals.subtotal },
    { label: "Shipping:", value: totals.shipping },
    { label: "Tax:", value: totals.tax },
    { label: "Discount:", value: totals.discount }
  ];

  const hasAction = Boolean(actionHref);

  return (
    <Card1>
      {rows.map((row) => (
        <FlexBox key={row.label} justifyContent="space-between" alignItems="center" mb="0.75rem">
          <Typography color="text.hint">{row.label}</Typography>
          <Typography fontSize="18px" fontWeight="600" lineHeight="1">
            {formatMoney(row.value)}
          </Typography>
        </FlexBox>
      ))}

      <Divider mb="1rem" />

      <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
        <Typography fontWeight="600">Total</Typography>
        <Typography fontSize="24px" fontWeight="700" lineHeight="1">
          {formatMoney(totals.total)}
        </Typography>
      </FlexBox>

      {totals.taxRate > 0 && (
        <Typography color="text.muted" fontSize="12px" textAlign="right" mb={hasAction ? "1rem" : undefined}>
          Tax rate applied: {totals.taxRate.toFixed(2)}%
          {totals.taxId ? ` · Tax ID ${totals.taxId}` : ""}
        </Typography>
      )}

      {!totals.taxRate && totals.taxId && (
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
