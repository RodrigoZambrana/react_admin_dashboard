"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";

import type { Money, ProductMode, ProductSummary, ProductVariantAttribute } from "@/types/storefront";
import {
  extractProductIdFromCartLineId,
  hasMeaningfulParametricConfiguration,
  isParametricCartLineId
} from "@/lib/checkout/order-items";
import { normalizeMoney } from "@/lib/utils/format";
import { useToast } from "@/contexts/ToastContext";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { buildCanonicalAnalyticsContext } from "@/lib/analytics/product-context";

export interface CartProductSnapshot {
  id: string;
  productId: number | string;
  mode?: ProductMode;
  variantId?: number;
  variantKey?: string;
  variantLabel?: string | null;
  selectionSummary?: string | null;
  slug: string;
  name: string;
  thumbnail?: ProductSummary["thumbnail"];
  price: Money;
  salePrice?: Money | null;
  inventoryStatus: ProductSummary["inventoryStatus"];
  attributes?: ProductVariantAttribute[];
  configuration?: Record<string, unknown>;
  canonicalConfiguration?: ProductSummary["canonicalConfiguration"];
}

export interface CartLineItem {
  product: CartProductSnapshot;
  quantity: number;
}

interface CartState {
  items: CartLineItem[];
  updatedAt: number;
}

type UpgradedCartStateResult = {
  state: CartState;
  droppedInvalidParametricItems: number;
};

type CartAction =
  | { type: "LOADED"; payload: CartState }
  | { type: "ADD_ITEM"; payload: { product: CartProductSnapshot; quantity: number } }
  | { type: "REMOVE_ITEM"; payload: { productId: number | string } }
  | {
      type: "UPDATE_QUANTITY";
      payload: { productId: number | string; quantity: number; product?: Partial<CartProductSnapshot> };
    }
  | { type: "CLEAR" };

export const initialState: CartState = {
  items: [],
  updatedAt: Date.now()
};

const STORAGE_KEY = "storefront.cart.v1";

const coerceCartConfiguration = (value: unknown): Record<string, unknown> | undefined => {
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
      console.warn("[cart] Failed to parse configuration", error);
    }
  }
  return undefined;
};

export const upgradeCartState = (state: CartState | null | undefined): UpgradedCartStateResult => {
  if (!state || !Array.isArray(state.items)) {
    return { state: { items: [], updatedAt: Date.now() }, droppedInvalidParametricItems: 0 };
  }

  let droppedInvalidParametricItems = 0;

  const upgradedItems: CartLineItem[] = state.items
    .map((item) => {
    const product = item.product ?? ({} as CartProductSnapshot);
    const rawQuantity = Number(item.quantity);
    const normalizedQuantity = Number.isFinite(rawQuantity) ? Math.max(1, rawQuantity) : 1;
    const legacyId = product.id ?? product.productId ?? "";
    let normalizedLineId = String(legacyId);
    if (!normalizedLineId || normalizedLineId.trim().length === 0) {
      normalizedLineId = `line-${Math.random().toString(36).slice(2)}`;
    }
    const normalizedProductId =
      product.productId ?? extractProductIdFromCartLineId(normalizedLineId) ?? legacyId ?? normalizedLineId;
    const variantIdValue =
      product.variantId !== undefined && product.variantId !== null
        ? Number(product.variantId)
        : undefined;
    const variantId =
      typeof variantIdValue === "number" && Number.isFinite(variantIdValue)
        ? variantIdValue
        : undefined;
    const rawConfiguration =
      (product as { configuration?: unknown }).configuration ??
      (product as { parametricConfiguration?: unknown }).parametricConfiguration ??
      (product as { config?: unknown }).config;
    const configuration = coerceCartConfiguration(rawConfiguration);
    const looksParametric = isParametricCartLineId(normalizedLineId);
    const requiresDynamicParametricConfiguration =
      looksParametric || hasMeaningfulParametricConfiguration(configuration);

    if (requiresDynamicParametricConfiguration && !configuration) {
      droppedInvalidParametricItems += 1;
      return null;
    }

    return {
      ...item,
      quantity: normalizedQuantity,
      product: {
        ...product,
        id: normalizedLineId,
        productId: normalizedProductId,
        mode: product.mode ?? (requiresDynamicParametricConfiguration ? "parametric" : undefined),
        variantId,
        variantKey: typeof product.variantKey === "string" ? product.variantKey : undefined,
        variantLabel: product.variantLabel ?? null,
        selectionSummary:
          typeof (product as { selectionSummary?: unknown }).selectionSummary === "string"
            ? ((product as { selectionSummary?: string }).selectionSummary ?? null)
            : null,
        attributes: Array.isArray(product.attributes) ? product.attributes : undefined,
        configuration,
        canonicalConfiguration:
          (product as { canonicalConfiguration?: ProductSummary["canonicalConfiguration"] }).canonicalConfiguration ??
          undefined
      }
    };
  })
    .filter(Boolean) as CartLineItem[];

  return {
    state: {
      items: upgradedItems,
      updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : Date.now()
    },
    droppedInvalidParametricItems
  };
};

export const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case "LOADED":
      return action.payload;
    case "ADD_ITEM": {
      const existing = state.items.find((item) => item.product.id === action.payload.product.id);
      const quantity = Number.isFinite(action.payload.quantity)
        ? Math.max(1, action.payload.quantity)
        : 1;
      const updatedItems = existing
        ? state.items.map((item) =>
            item.product.id === action.payload.product.id
              ? {
                  ...item,
                  product: {
                    ...item.product,
                    ...action.payload.product,
                    configuration:
                      action.payload.product.configuration ?? item.product.configuration,
                    mode: action.payload.product.mode ?? item.product.mode
                  },
                  quantity: item.quantity + quantity
                }
              : item
          )
        : [...state.items, { product: action.payload.product, quantity }];
      return { items: updatedItems, updatedAt: Date.now() };
    }
    case "REMOVE_ITEM":
      return {
        items: state.items.filter((item) => item.product.id !== action.payload.productId),
        updatedAt: Date.now()
      };
    case "UPDATE_QUANTITY": {
      const updatedItems = state.items
        .map((item) => {
          if (item.product.id !== action.payload.productId) return item;
          const numericQuantity = Number.isFinite(action.payload.quantity)
            ? action.payload.quantity
            : 0;
          const nextQuantity = Math.max(0, numericQuantity);
          if (nextQuantity === 0) return null;
          return {
            ...item,
            quantity: nextQuantity,
            product: action.payload.product
              ? {
                  ...item.product,
                  ...action.payload.product,
                  configuration: action.payload.product.configuration ?? item.product.configuration,
                  selectionSummary:
                    action.payload.product.selectionSummary ?? item.product.selectionSummary,
                  variantLabel: action.payload.product.variantLabel ?? item.product.variantLabel
                }
              : item.product
          };
        })
        .filter(Boolean) as CartLineItem[];
      return { items: updatedItems, updatedAt: Date.now() };
    }
    case "CLEAR":
      return { items: [], updatedAt: Date.now() };
    default:
      return state;
  }
};

const CartContext = createContext<{
  state: CartState;
  isHydrated: boolean;
  addItem: (product: ProductSummary, quantity?: number) => void;
  addItemSnapshot: (product: CartProductSnapshot, quantity?: number) => void;
  removeItem: (productId: number | string) => void;
  updateQuantity: (
    productId: number | string,
    quantity: number,
    product?: Partial<CartProductSnapshot>
  ) => void;
  clearCart: () => void;
  subtotal: Money;
}>(
  {
    state: initialState,
    isHydrated: false,
    addItem: () => undefined,
    addItemSnapshot: () => undefined,
    removeItem: () => undefined,
    updateQuantity: () => undefined,
    clearCart: () => undefined,
    subtotal: { amount: 0, currency: "USD", formatted: "$0.00" }
  }
);

const snapshotProduct = (product: ProductSummary): CartProductSnapshot => {
  const productId = product.id;
  const variantIdValue =
    product.variantId !== undefined && product.variantId !== null
      ? Number(product.variantId)
      : undefined;
  const variantId =
    typeof variantIdValue === "number" && Number.isFinite(variantIdValue)
      ? variantIdValue
      : undefined;
  const variantKey =
    typeof product.variantKey === "string" && product.variantKey.trim().length > 0
      ? product.variantKey
      : undefined;
  const configuration = coerceCartConfiguration(
    (product as { configuration?: unknown }).configuration ??
      (product as { parametricConfiguration?: unknown }).parametricConfiguration ??
      (product as { config?: unknown }).config
  );

  return {
    id: String(productId),
    productId,
    mode: product.mode ?? (configuration ? "parametric" : undefined),
    variantId,
    variantKey,
    variantLabel: product.variantLabel ?? null,
    selectionSummary:
      typeof (product as { selectionSummary?: unknown }).selectionSummary === "string"
        ? ((product as { selectionSummary?: string }).selectionSummary ?? null)
        : null,
    slug: product.slug,
    name: product.name,
    price: normalizeMoney(product.price),
    salePrice: product.salePrice ? normalizeMoney(product.salePrice) : null,
    thumbnail: product.thumbnail,
    inventoryStatus: product.inventoryStatus,
    attributes: Array.isArray(product.attributes) ? product.attributes : undefined,
    configuration,
    canonicalConfiguration: product.canonicalConfiguration ?? null
  };
};

export const StorefrontCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const toast = useToast();
  const stateRef = useRef(state);

  useEffect(() => {
    if (isHydrated) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (Array.isArray(parsed.items)) {
          const upgraded = upgradeCartState(parsed);
          dispatch({ type: "LOADED", payload: upgraded.state });
          if (upgraded.droppedInvalidParametricItems > 0) {
            toast.info({
              title: "Carrito actualizado",
              description:
                upgraded.droppedInvalidParametricItems === 1
                  ? "Se quitó una configuración paramétrica incompleta del carrito. Vuelve a configurarla para continuar."
                  : "Se quitaron configuraciones paramétricas incompletas del carrito. Vuelve a configurarlas para continuar."
            });
          }
        }
      }
    } catch (error) {
      console.warn("[cart] Failed to load cart from storage", error);
    } finally {
      setIsHydrated(true);
    }
  }, [isHydrated, toast]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("[cart] Failed to persist cart to storage", error);
    }
  }, [isHydrated, state]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const formatProductName = useCallback((product: CartProductSnapshot) => {
    if (!product) return "Producto";
    return product.variantLabel
      ? `${product.name} · ${product.variantLabel}`
      : product.name;
  }, []);

  const addItem = useCallback(
    (product: ProductSummary, quantity = 1) => {
      dispatch({ type: "ADD_ITEM", payload: { product: snapshotProduct(product), quantity } });
      const canonicalContext = buildCanonicalAnalyticsContext({
        canonicalConfiguration: product.canonicalConfiguration ?? null,
        configuration: product.configuration ?? null
      });
      void trackEvent({
        event_name: "add_to_cart",
        event_category: "ecommerce",
        tenant_id: env.clientSlug,
        page_type: resolvePageType(typeof window !== "undefined" ? window.location.pathname : null),
        component_type: "cart_context",
        component_id: "cart_context_add_item",
        cta_id: "cart.add_item",
        cta_name: "add_to_cart",
        cta_type: "primary",
        cta_context: "ecommerce",
        cta_location: "cart_state",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          product_id: product.productId ?? product.id,
          product_slug: product.slug,
          quantity,
          price: product.price.amount,
          currency: product.price.currency,
          variant_id: product.variantId ?? null,
          variant_key: product.variantKey ?? null,
          ...canonicalContext
        },
        data: {
          product_id: product.productId ?? product.id,
          product_slug: product.slug,
          quantity,
          price: product.price.amount,
          currency: product.price.currency,
          variant_id: product.variantId ?? null,
          variant_key: product.variantKey ?? null,
          ...canonicalContext
        },
      });
      toast.success({
        title: "Producto agregado",
        description: `${product.name} se añadió al carrito.`
      });
    },
    [toast]
  );

  const addItemSnapshot = useCallback(
    (product: CartProductSnapshot, quantity = 1) => {
      dispatch({ type: "ADD_ITEM", payload: { product, quantity } });
      const canonicalContext = buildCanonicalAnalyticsContext({
        canonicalConfiguration: product.canonicalConfiguration ?? null,
        configuration: product.configuration ?? null
      });
      void trackEvent({
        event_name: "add_to_cart",
        event_category: "ecommerce",
        tenant_id: env.clientSlug,
        page_type: resolvePageType(typeof window !== "undefined" ? window.location.pathname : null),
        component_type: "cart_context",
        component_id: "cart_context_add_item_snapshot",
        cta_id: "cart.add_item",
        cta_name: "add_to_cart",
        cta_type: "primary",
        cta_context: "ecommerce",
        cta_location: "cart_state",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          product_id: product.productId ?? product.id,
          product_slug: product.slug,
          quantity,
          price: product.price.amount,
          currency: product.price.currency,
          variant_id: product.variantId ?? null,
          variant_key: product.variantKey ?? null,
          ...canonicalContext
        },
        data: {
          product_id: product.productId ?? product.id,
          product_slug: product.slug,
          quantity,
          price: product.price.amount,
          currency: product.price.currency,
          variant_id: product.variantId ?? null,
          variant_key: product.variantKey ?? null,
          ...canonicalContext
        },
      });
      toast.success({
        title: "Producto agregado",
        description: `${product.name} se añadió al carrito.`
      });
    },
    [toast]
  );

  const removeItem = useCallback(
    (productId: number | string) => {
      const product = stateRef.current.items.find((item) => item.product.id === productId)?.product;
      dispatch({ type: "REMOVE_ITEM", payload: { productId } });
      toast.info({
        title: "Producto eliminado",
        description: product
          ? `${formatProductName(product)} fue quitado del carrito.`
          : "Producto quitado del carrito."
      });
    },
    [formatProductName, toast]
  );

  const updateQuantity = useCallback(
    (productId: number | string, quantity: number, product?: Partial<CartProductSnapshot>) => {
      const lineItem = stateRef.current.items.find((item) => item.product.id === productId);
      const previousQuantity = lineItem?.quantity ?? 0;
      dispatch({ type: "UPDATE_QUANTITY", payload: { productId, quantity, product } });
      if (quantity <= 0) {
        toast.info({
          title: "Producto eliminado",
          description: lineItem
            ? `${formatProductName(lineItem.product)} se retiró del carrito.`
            : "Producto retirado del carrito."
        });
      } else if (quantity !== previousQuantity) {
        toast.success({
          title: "Cantidad actualizada",
          description: lineItem
            ? `Ahora tienes ${quantity} unidad${quantity === 1 ? "" : "es"} de ${formatProductName(
                lineItem.product
              )}.`
            : "Actualizaste la cantidad en el carrito."
        });
      }
    },
    [formatProductName, toast]
  );

  const clearCart = useCallback(() => {
    const hadItems = stateRef.current.items.length > 0;
    dispatch({ type: "CLEAR" });
    if (hadItems) {
      toast.info({
        title: "Carrito vacío",
        description: "Vaciaste tu carrito de compras."
      });
    }
  }, [toast]);

  const subtotal = useMemo<Money>(() => {
    if (state.items.length === 0) {
      return { amount: 0, currency: "USD", formatted: "$0.00" };
    }

    const currency =
      state.items[0].product.salePrice?.currency ?? state.items[0].product.price.currency;
    const amount = state.items.reduce((sum, item) => {
      const unit = item.product.salePrice ?? item.product.price;
      return sum + unit.amount * item.quantity;
    }, 0);
    return normalizeMoney({ amount, currency });
  }, [state.items]);

  const value = useMemo(
    () => ({
      state,
      isHydrated,
      addItem,
      addItemSnapshot,
      removeItem,
      updateQuantity,
      clearCart,
      subtotal
    }),
    [state, isHydrated, addItem, addItemSnapshot, removeItem, updateQuantity, clearCart, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useStorefrontCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useStorefrontCart must be used within a StorefrontCartProvider");
  }
  return context;
};
