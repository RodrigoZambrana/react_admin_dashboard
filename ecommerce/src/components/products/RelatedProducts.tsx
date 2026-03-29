import Product from "@models/product.model";
import { useTranslation } from "@/state/i18n-context";
import ProductRecommendationGrid from "@component/products/ProductRecommendationGrid";

// ============================================================
type Props = { products: Product[]; title?: string };
// ============================================================

export default function RelatedProducts({ products, title }: Props) {
  const t = useTranslation();

  return (
    <ProductRecommendationGrid
      title={title || t("product.related.title", { defaultMessage: "Related Products" })}
      products={products}
    />
  );
}
