"use client";

import type Product from "@models/product.model";
import { useEffect } from "react";

import { trackViewItem } from "@/lib/analytics";

type ProductViewAnalyticsProps = {
  product: Product;
};

export default function ProductViewAnalytics({ product }: ProductViewAnalyticsProps) {
  useEffect(() => {
    trackViewItem(product);
  }, [product]);

  return null;
}
