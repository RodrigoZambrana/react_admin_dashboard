"use client";

import { useMemo, useReducer, createContext, PropsWithChildren } from "react";
import { INITIAL_CART } from "@data/cart";

// ==============================================================
interface CartItem {
  qty: number;
  name: string;
  slug?: string;
  price: number;
  imgUrl?: string;
  id: string | number;
}

interface InitialState {
  cart: CartItem[];
}

interface CartAction {
  payload: CartItem;
  type: "CHANGE_CART_AMOUNT";
}

interface ContextProps {
  state: InitialState;
  dispatch: (args: CartAction) => void;
}
// ==============================================================

const INITIAL_STATE = { cart: INITIAL_CART };

export const CartContext = createContext<ContextProps>({
  state: INITIAL_STATE,
  dispatch: () => {}
});

const reducer = (state: InitialState, action: CartAction) => {
  switch (action.type) {
    case "CHANGE_CART_AMOUNT":
      const currentCart = state.cart;
      const updatedItem = action.payload;
      const itemExists = currentCart.find((item) => item.id === updatedItem.id);

      if (updatedItem.qty < 1) {
        return {
          ...state,
          cart: currentCart.filter((item) => item.id !== updatedItem.id)
        };
      }

      if (itemExists) {
        const updatedCart = currentCart.map((item) => {
          return item.id === updatedItem.id ? { ...item, qty: updatedItem.qty } : item;
        });

        return { ...state, cart: updatedCart };
      }

      return {
        ...state,
        cart: [...currentCart, updatedItem]
      };

    default:
      return state;
  }
};

export default function CartProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const contextValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <CartContext value={contextValue}>{children}</CartContext>;
}
