"use client";

import { useCallback, useMemo } from "react";

import { normalizeMoney } from "@/lib/utils/format";
import { useStorefrontCart, type CartProductSnapshot } from "@/state/cart-context";
import type { Money } from "@/types/storefront";

type LegacyCartItem = {
  qty: number;
  name: string;
  slug?: string;
  price: number;
  imgUrl?: string;
  id: string | number;
  currency?: Money["currency"];
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

  const items = state.items;

  const legacyCart = useMemo<LegacyCartItem[]>(() => {
    return items.map((item) => {
      const unit = item.product.salePrice ?? item.product.price;
      return {
        id: item.product.id,
        name: item.product.name,
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

      const { id, qty, price, slug, name, imgUrl, currency } = action.payload;
      const normalizedId = id;
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

      const resolvedCurrency = currency ?? items[0]?.product.price.currency ?? "USD";

      const snapshot: CartProductSnapshot = {
        id: normalizedId,
        slug: slug ?? String(normalizedId),
        name,
        price: normalizeMoney({ amount: price, currency: resolvedCurrency }),
        salePrice: null,
        thumbnail: imgUrl
          ? {
              id: String(normalizedId),
              url: imgUrl
            }
          : undefined,
        inventoryStatus: "in-stock"
      };

      addItemSnapshot(snapshot, nextQuantity);
    },
    [addItemSnapshot, items, removeItem, updateQuantity]
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
    itemCount
  };
}
