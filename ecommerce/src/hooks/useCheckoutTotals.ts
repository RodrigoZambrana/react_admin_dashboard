import { useEffect, useMemo, useState } from "react";

import { StorefrontApi } from "@/lib/api/storefront";
import { normalizeMoney } from "@/lib/utils/format";
import type { Money } from "@/types/storefront";
import { useStorefrontCart } from "@/state/cart-context";
import { useCheckout } from "@/state/checkout-context";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";

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

const DEFAULT_TAX_RATE = 22;

const toMoney = (amount: number, currency: string): Money =>
  normalizeMoney({ amount, currency } as Money);

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export interface CheckoutTotals {
  subtotal: Money;
  shipping: Money;
  tax: Money;
  discount: Money;
  total: Money;
  taxRate: number;
  taxId?: string;
  currency: string;
}

export function useCheckoutTotals() {
  const { subtotal } = useStorefrontCart();
  const { shippingOption } = useCheckout();
  const config = useStorefrontConfig();
  const [remoteTax, setRemoteTax] = useState<{ rate?: number; taxId?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const remoteConfig = await StorefrontApi.getConfig();
        if (cancelled) return;
        const record = remoteConfig as Record<string, any>;
        const companyConfig = (record?.companyProfile ?? {}) as Record<string, any>;
        const derivedRate =
          parseTaxRate(companyConfig?.taxRate) ??
          parseTaxRate(record?.taxRate) ??
          parseTaxRate(record?.checkout?.taxRate) ??
          parseTaxRate(record?.pricing?.taxRate);
        const derivedTaxId =
          typeof companyConfig?.taxId === "string" ? companyConfig.taxId : undefined;
        setRemoteTax({ rate: derivedRate, taxId: derivedTaxId });
      } catch (error) {
        if (!cancelled) {
          setRemoteTax((current) => current ?? null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo<CheckoutTotals>(() => {
    const currency = subtotal.currency ?? "USD";
    const grossAmount = roundCurrency(subtotal.amount);
    const configRecord = config as Record<string, any>;
    const profileRecord = (config.companyProfile ?? {}) as Record<string, any>;

    const taxRateCandidate =
      remoteTax?.rate ??
      parseTaxRate(profileRecord?.taxRate) ??
      parseTaxRate(configRecord?.taxRate) ??
      parseTaxRate(configRecord?.checkout?.taxRate) ??
      parseTaxRate(configRecord?.pricing?.taxRate);

    const taxRateRaw = taxRateCandidate ?? DEFAULT_TAX_RATE;
    const taxRate = taxRateRaw > 0 ? taxRateRaw : 0;

    const subtotalAmount =
      taxRate > 0 ? roundCurrency(grossAmount / (1 + taxRate / 100)) : grossAmount;
    let taxAmount = taxRate > 0 ? roundCurrency(grossAmount - subtotalAmount) : 0;
    if (taxAmount < 0) {
      taxAmount = 0;
    }

    const totalAmount = roundCurrency(subtotalAmount + taxAmount);
    const correctedTotal = roundCurrency(grossAmount);
    if (Math.abs(correctedTotal - totalAmount) >= 0.01) {
      taxAmount = Math.max(0, roundCurrency(correctedTotal - subtotalAmount));
    }

    const shippingAmount = roundCurrency(shippingOption?.deliveryFees ?? 0);
    const discountAmount = 0;
    const finalTotalAmount = roundCurrency(correctedTotal + shippingAmount - discountAmount);

    return {
      taxRate,
      taxId:
        remoteTax?.taxId ??
        (typeof profileRecord?.taxId === "string" ? profileRecord.taxId : undefined),
      subtotal: toMoney(subtotalAmount, currency),
      shipping: toMoney(shippingAmount, currency),
      tax: toMoney(taxAmount, currency),
      discount: toMoney(discountAmount, currency),
      total: toMoney(finalTotalAmount, currency),
      currency
    };
  }, [config, subtotal, remoteTax, shippingOption?.deliveryFees]);

  return { totals, loading } as const;
}
