"use client";

import type { CheckoutPayment, CheckoutAddress, CheckoutContact } from "@/state/checkout-context";
import type { OrderSummary, StorefrontFulfillmentMode, StorefrontShippingOption } from "@/types/storefront";
import type { CheckoutOrderItemInput } from "@/lib/checkout/order-items";

const STORAGE_KEY = "storefront:checkout:state";
const ORDER_ITEMS_STORAGE_KEY_PREFIX = "storefront:checkout:order-items:";

export type PersistedCheckoutState = {
  contact: CheckoutContact;
  shippingAddress: CheckoutAddress;
  fulfillmentMode: StorefrontFulfillmentMode;
  shippingOption: StorefrontShippingOption | null;
  payment: CheckoutPayment | null;
  notes: string;
  completed: Record<"details" | "payment", boolean>;
  lastOrder?: OrderSummary | null;
  checkoutToken: string;
};

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const loadPersistedCheckoutState = (): PersistedCheckoutState | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PersistedCheckoutState;
  } catch {
    return null;
  }
};

export const savePersistedCheckoutState = (state: PersistedCheckoutState) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
};

export const clearPersistedCheckoutState = () => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
};

const getOrderItemsStorageKey = (checkoutToken: string) =>
  `${ORDER_ITEMS_STORAGE_KEY_PREFIX}${checkoutToken}`;

export const loadPersistedCheckoutOrderItems = (
  checkoutToken?: string | null
): CheckoutOrderItemInput[] | null => {
  const storage = getStorage();
  if (!storage || !checkoutToken) {
    return null;
  }

  try {
    const raw = storage.getItem(getOrderItemsStorageKey(checkoutToken));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CheckoutOrderItemInput[];
  } catch {
    return null;
  }
};

export const savePersistedCheckoutOrderItems = (
  checkoutToken: string,
  items: CheckoutOrderItemInput[]
) => {
  const storage = getStorage();
  if (!storage || !checkoutToken) {
    return;
  }

  try {
    storage.setItem(getOrderItemsStorageKey(checkoutToken), JSON.stringify(items));
  } catch {
    // noop
  }
};

export const clearPersistedCheckoutOrderItems = (checkoutToken?: string | null) => {
  const storage = getStorage();
  if (!storage || !checkoutToken) {
    return;
  }

  try {
    storage.removeItem(getOrderItemsStorageKey(checkoutToken));
  } catch {
    // noop
  }
};
