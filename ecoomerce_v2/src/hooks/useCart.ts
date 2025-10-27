import { use } from "react";
import { CartContext } from "@context/CartContext";

export default function useCart() {
  const context = use(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}
