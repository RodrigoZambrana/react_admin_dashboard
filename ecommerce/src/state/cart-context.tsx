"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef
} from "react";

import type { Money, ProductSummary } from "@/types/storefront";
import { normalizeMoney } from "@/lib/utils/format";
import { useToast } from "@/contexts/ToastContext";

export interface CartProductSnapshot {
  id: number | string;
  slug: string;
  name: string;
  thumbnail?: ProductSummary["thumbnail"];
  price: Money;
  salePrice?: Money | null;
  inventoryStatus: ProductSummary["inventoryStatus"];
}

export interface CartLineItem {
  product: CartProductSnapshot;
  quantity: number;
}

interface CartState {
  items: CartLineItem[];
  updatedAt: number;
}

type CartAction =
  | { type: "LOADED"; payload: CartState }
  | { type: "ADD_ITEM"; payload: { product: CartProductSnapshot; quantity: number } }
  | { type: "REMOVE_ITEM"; payload: { productId: number | string } }
  | { type: "UPDATE_QUANTITY"; payload: { productId: number | string; quantity: number } }
  | { type: "CLEAR" };

const initialState: CartState = {
  items: [],
  updatedAt: Date.now()
};

const STORAGE_KEY = "storefront.cart.v1";

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case "LOADED":
      return action.payload;
    case "ADD_ITEM": {
      const existing = state.items.find((item) => item.product.id === action.payload.product.id);
      const quantity = Math.max(1, action.payload.quantity);
      const updatedItems = existing
        ? state.items.map((item) =>
            item.product.id === action.payload.product.id
              ? { ...item, quantity: item.quantity + quantity }
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
          const nextQuantity = Math.max(0, action.payload.quantity);
          if (nextQuantity === 0) return null;
          return { ...item, quantity: nextQuantity };
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
  addItem: (product: ProductSummary, quantity?: number) => void;
  addItemSnapshot: (product: CartProductSnapshot, quantity?: number) => void;
  removeItem: (productId: number | string) => void;
  updateQuantity: (productId: number | string, quantity: number) => void;
  clearCart: () => void;
  subtotal: Money;
}>(
  {
    state: initialState,
    addItem: () => undefined,
    addItemSnapshot: () => undefined,
    removeItem: () => undefined,
    updateQuantity: () => undefined,
    clearCart: () => undefined,
    subtotal: { amount: 0, currency: "USD", formatted: "$0.00" }
  }
);

const snapshotProduct = (product: ProductSummary): CartProductSnapshot => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  price: normalizeMoney(product.price),
  salePrice: product.salePrice ? normalizeMoney(product.salePrice) : null,
  thumbnail: product.thumbnail,
  inventoryStatus: product.inventoryStatus
});

export const StorefrontCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const toast = useToast();
  const isHydrated = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    if (isHydrated.current) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (Array.isArray(parsed.items)) {
          dispatch({ type: "LOADED", payload: parsed });
        }
      }
    } catch (error) {
      console.warn("[cart] Failed to load cart from storage", error);
    } finally {
      isHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isHydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("[cart] Failed to persist cart to storage", error);
    }
  }, [state]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const addItem = useCallback(
    (product: ProductSummary, quantity = 1) => {
      dispatch({ type: "ADD_ITEM", payload: { product: snapshotProduct(product), quantity } });
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
        description: product ? `${product.name} fue quitado del carrito.` : "Producto quitado del carrito."
      });
    },
    [toast]
  );

  const updateQuantity = useCallback(
    (productId: number | string, quantity: number) => {
      const lineItem = stateRef.current.items.find((item) => item.product.id === productId);
      const previousQuantity = lineItem?.quantity ?? 0;
      dispatch({ type: "UPDATE_QUANTITY", payload: { productId, quantity } });
      if (quantity <= 0) {
        toast.info({
          title: "Producto eliminado",
          description: lineItem
            ? `${lineItem.product.name} se retiró del carrito.`
            : "Producto retirado del carrito."
        });
      } else if (quantity !== previousQuantity) {
        toast.success({
          title: "Cantidad actualizada",
          description: lineItem
            ? `Ahora tienes ${quantity} unidad${quantity === 1 ? "" : "es"} de ${lineItem.product.name}.`
            : "Actualizaste la cantidad en el carrito."
        });
      }
    },
    [toast]
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
    () => ({ state, addItem, addItemSnapshot, removeItem, updateQuantity, clearCart, subtotal }),
    [state, addItem, addItemSnapshot, removeItem, updateQuantity, clearCart, subtotal]
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
