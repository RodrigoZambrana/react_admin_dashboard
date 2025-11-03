"use client";

import dynamic from "next/dynamic";

const FeaturedProductsPanel = dynamic(
  () => import("@/components/panels/FeaturedProductsPanel"),
  { ssr: false, loading: () => null }
);

export default FeaturedProductsPanel;
