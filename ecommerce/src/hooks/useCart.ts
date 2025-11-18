"use client";

import { useCallback, useMemo } from "react";

import { normalizeMoney } from "@/lib/utils/format";
import { useStorefrontCart, type CartProductSnapshot, type CartLineItem } from "@/state/cart-context";
import type {
  InventoryStatus,
  Money,
  ProductMode,
  ProductVariantAttribute
} from "@/types/storefront";
import { useCurrency } from "@/state/currency-context";

const coerceLegacyConfiguration = (value: unknown): Record<string, unknown> | undefined => {
  if (!value) return undefined;
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("[cart] Failed to parse legacy configuration payload", error);
    }
  }
  return undefined;
};

type LegacyCartItem = {
  qty: number;
  name: string;
  slug?: string;
  price: number;
  imgUrl?: string;
  id: string | number;
  currency?: Money["currency"];
  salePrice?: number | null;
  mode?: ProductMode;
  variantId?: number | null;
  variantKey?: string | null;
  variantLabel?: string | null;
  attributes?: ProductVariantAttribute[];
  configuration?: Record<string, unknown> | string | null;
  inventoryStatus?: InventoryStatus;
};

type LegacyCartState = {
  cart: LegacyCartItem[];
  updatedAt: number;
};

type LegacyCartAction = {
  payload: LegacyCartItem;
  type: "CHANGE_CART_AMOUNT";
};

type UseCartReturn = {
  state: LegacyCartState;
  dispatch: (args: LegacyCartAction) => void;
  addItemSnapshot: (product: CartProductSnapshot, quantity?: number) => void;
  addItem: ReturnType<typeof useStorefrontCart>["addItem"];
  removeItem: ReturnType<typeof useStorefrontCart>["removeItem"];
  updateQuantity: ReturnType<typeof useStorefrontCart>["updateQuantity"];
  clearCart: ReturnType<typeof useStorefrontCart>["clearCart"];
  subtotal: Money;
  itemCount: number;
  items: CartLineItem[];
};

export default function useCart(): UseCartReturn {
  const {
    state,
    addItem,
    addItemSnapshot,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal
  } = useStorefrontCart();
  const { baseCurrency } = useCurrency();

  const items = state.items;

  const legacyCart = useMemo<LegacyCartItem[]>(() => {
    return items.map((item) => {
      const unit = item.product.salePrice ?? item.product.price;
      const displayName = item.product.variantLabel
        ? `${item.product.name} · ${item.product.variantLabel}`
        : item.product.name;
      return {
        id: item.product.id,
        name: displayName,
        slug: item.product.slug,
        imgUrl: item.product.thumbnail?.url,
        price: unit.amount,
        currency: unit.currency,
        qty: item.quantity
      };
    });
  }, [items]);

  const legacyState = useMemo<LegacyCartState>(() => {
    return {
      cart: legacyCart,
      updatedAt: state.updatedAt
    };
  }, [legacyCart, state.updatedAt]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const dispatch = useCallback(
    (action: LegacyCartAction) => {
      if (action.type !== "CHANGE_CART_AMOUNT") return;

      const {
        id,
        qty,
        price,
        slug,
        name,
        imgUrl,
        currency,
        salePrice,
        mode,
        variantId: payloadVariantId,
        variantKey,
        variantLabel,
        attributes,
        configuration: payloadConfiguration,
        inventoryStatus
      } = action.payload;
      const normalizedId = typeof id === "number" ? String(id) : id;
      const nextQuantity = Math.max(0, qty);

      if (nextQuantity === 0) {
        removeItem(normalizedId);
        return;
      }

      const exists = items.some((item) => item.product.id === normalizedId);
      if (exists) {
        updateQuantity(normalizedId, nextQuantity);
        return;
      }

      const resolvedCurrency = currency ?? items[0]?.product.price.currency ?? baseCurrency;
      const resolvedConfiguration = coerceLegacyConfiguration(payloadConfiguration);
      const normalizedVariantId =
        payloadVariantId !== undefined && payloadVariantId !== null
          ? Number(payloadVariantId)
          : undefined;
      const variantId =
        typeof normalizedVariantId === "number" && Number.isFinite(normalizedVariantId)
          ? normalizedVariantId
          : undefined;
      const resolvedVariantKey =
        typeof variantKey === "string" && variantKey.trim().length > 0 ? variantKey : undefined;
      const resolvedVariantLabel = variantLabel ?? null;
      const resolvedAttributes = Array.isArray(attributes) ? attributes : undefined;
      const resolvedInventoryStatus = inventoryStatus ?? "in-stock";

      const snapshot: CartProductSnapshot = {
        id: String(normalizedId),
        productId: normalizedId,
        mode: mode ?? (resolvedConfiguration ? "parametric" : undefined),
        variantId,
        variantKey: resolvedVariantKey,
        variantLabel: resolvedVariantLabel,
        slug: slug ?? String(normalizedId),
        name,
        price: normalizeMoney({ amount: price, currency: resolvedCurrency }),
        salePrice:
          typeof salePrice === "number"
            ? normalizeMoney({ amount: salePrice, currency: resolvedCurrency })
            : null,
        thumbnail: imgUrl
          ? {
              id: String(normalizedId),
              url: imgUrl
            }
          : undefined,
        inventoryStatus: resolvedInventoryStatus,
        attributes: resolvedAttributes,
        configuration: resolvedConfiguration
      };

      addItemSnapshot(snapshot, nextQuantity);
    },
    [addItemSnapshot, baseCurrency, items, removeItem, updateQuantity]
  );

  return {
    state: legacyState,
    dispatch,
    addItemSnapshot,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    itemCount,
    items
  };
}
