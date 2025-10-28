import { useEffect, useMemo, useState } from "react";

import { StorefrontApi } from "@/lib/api/storefront";
import { normalizeMoney } from "@/lib/utils/format";
import type { Money } from "@/types/storefront";
import { useStorefrontCart } from "@/state/cart-context";
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
    const configRecord = config as Record<string, any>;
    const profileRecord = (config.companyProfile ?? {}) as Record<string, any>;

    const taxRateCandidate =
      remoteTax?.rate ??
      parseTaxRate(profileRecord?.taxRate) ??
      parseTaxRate(configRecord?.taxRate) ??
      parseTaxRate(configRecord?.checkout?.taxRate) ??
      parseTaxRate(configRecord?.pricing?.taxRate);

    const taxRate = taxRateCandidate ?? 0;
    const taxAmount = subtotal.amount > 0 ? roundCurrency(subtotal.amount * (taxRate / 100)) : 0;

    const shippingAmount = 0;
    const discountAmount = 0;
    const totalAmount = roundCurrency(subtotal.amount + taxAmount + shippingAmount - discountAmount);

    return {
      taxRate,
      taxId:
        remoteTax?.taxId ??
        (typeof profileRecord?.taxId === "string" ? profileRecord.taxId : undefined),
      subtotal,
      shipping: toMoney(shippingAmount, currency),
      tax: toMoney(taxAmount, currency),
      discount: toMoney(discountAmount, currency),
      total: toMoney(totalAmount, currency),
      currency
    };
  }, [config, subtotal, remoteTax]);

  return { totals, loading } as const;
}
