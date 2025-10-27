"use client";

import ProductGridView from "@component/products/ProductCard1List";
import Shop from "@models/shop.model";
import Product from "@models/product.model";

// ==============================================================
type Props = { shop: Shop };
// ==============================================================

export default function ProductDetails({ shop }: Props) {
  return <ProductGridView products={shop.products?.slice(0, 9) as Product[]} />;
}
