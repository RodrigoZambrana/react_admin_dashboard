import Product from "@models/product.model";
import { useTranslation } from "@/state/i18n-context";
import ProductRecommendationGrid from "@component/products/ProductRecommendationGrid";

// ============================================================
type Props = { products: Product[] };
// ============================================================

export default function FrequentlyBought({ products }: Props) {
  const t = useTranslation();

  return (
    <ProductRecommendationGrid
      title={t("product.frequentlyBought.title", {
        defaultMessage: "Frequently Bought Together"
      })}
      products={products}
    />
  );
}
