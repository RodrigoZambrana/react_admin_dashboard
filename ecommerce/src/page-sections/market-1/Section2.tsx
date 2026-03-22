"use client";

import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import ProductCard1 from "@component/product-cards/ProductCard1";
import CategorySectionCreator from "@component/CategorySectionCreator";
import SkeletonPanel from "@/components/status/SkeletonPanel";
import { Paragraph } from "@component/Typography";
import { StorefrontApi } from "@/lib/api/storefront";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import type Product from "@models/product.model";
import { usePanelResource } from "@/hooks/usePanelResource";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useTranslation } from "@/state/i18n-context";

const requestFeaturedProducts = async (): Promise<Product[]> => {
  const response = await StorefrontApi.listProducts({
    sort: "featured",
    pageSize: 12,
  });

  return response.data.map(mapProductSummaryToProduct);
};

export default function Section2() {
  const config = useStorefrontConfig();
  const t = useTranslation();
  const snapshotEnabled = config.resilience?.snapshotFallbackEnabled !== false;
  const { data, status } = usePanelResource<Product[]>({
    cacheKey: "home.featured-grid",
    request: requestFeaturedProducts,
    staleMs: 5 * 60_000,
    snapshotEnabled,
  });

  const products = data ?? [];

  return (
    <CategorySectionCreator iconName="light" title="Flash Deals" seeMoreLink="/shop?sort=featured">
      {status === "loading" && products.length === 0 ? (
        <SkeletonPanel lines={4} height={12} />
      ) : products.length === 0 ? (
        <Card p="1.5rem" borderRadius={8}>
          <Paragraph color="text.muted" textAlign="center">
            {t("home.featured.empty", {
              defaultMessage: "We couldn't load the featured products right now.",
            })}
          </Paragraph>
        </Card>
      ) : (
        <Card p="1rem" borderRadius={8}>
          <Grid container spacing={6}>
            {products.map((item) => (
              <Grid item lg={3} md={4} sm={6} xs={12} key={item.id}>
                <ProductCard1
                  id={item.id}
                  slug={item.slug}
                  title={item.title}
                  price={item.price}
                  basePrice={item.basePrice}
                  currencyCode={item.currency}
                  off={item.discount ?? 0}
                  imgUrl={item.thumbnail}
                  images={item.images}
                  rating={item.rating ?? 4}
                />
              </Grid>
            ))}
          </Grid>
        </Card>
      )}
    </CategorySectionCreator>
  );
}
