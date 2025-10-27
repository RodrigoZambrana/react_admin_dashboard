"use client";

import type { PropsWithChildren } from "react";

import { StorefrontCartProvider } from "@/state/cart-context";

export default function CartProvider({ children }: PropsWithChildren) {
  return <StorefrontCartProvider>{children}</StorefrontCartProvider>;
}
