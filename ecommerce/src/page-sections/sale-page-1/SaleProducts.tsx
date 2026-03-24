"use client";

import { Fragment, memo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Pagination from "@component/pagination";
import { SemiSpan } from "@component/Typography";
import { ProductCard1 } from "@component/product-cards";
import { renderProductCount } from "@utils/utils";
import Product from "@models/product.model";
import { Meta } from "interfaces";
import { useTranslation } from "@/state/i18n-context";

// ==============================================================
interface Props {
  meta: Meta;
  products: Product[];
  selectedCategorySlug?: string;
  selectedCategoryLabel?: string;
  searchTerm?: string;
  view?: "grid" | "list";
}
// ==============================================================

function SaleProducts({
  products,
  meta,
  selectedCategorySlug,
  selectedCategoryLabel,
  searchTerm,
  view = "grid",
}: Props) {
  const { push } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasProducts = products.length > 0;
  const t = useTranslation();

  const handlePageChange = useCallback(
    (page: number) => {
      if (!pathname) return;

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("page", String(page + 1));
      if (selectedCategorySlug) {
        params.set("category", selectedCategorySlug);
      } else {
        params.delete("category");
      }
      const query = params.toString();
      push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, push, searchParams, selectedCategorySlug]
  );

  return (
    <Fragment>
      {hasProducts ? (
        <Grid container spacing={6}>
          {products.map((item: Product) => (
            <Grid
              item
              lg={view === "grid" ? 3 : 12}
              md={view === "grid" ? 4 : 12}
              sm={view === "grid" ? 6 : 12}
              xs={12}
              key={item.slug}>
              <ProductCard1
                id={item.id}
                slug={item.slug}
                price={item.salePrice ?? item.price}
                basePrice={item.basePrice}
                currencyCode={item.currency}
                mode={item.mode}
                title={item.title}
                off={item.discount}
                images={item.images}
                imgUrl={item.thumbnail}
                rating={item.rating || 4}
                variantKey={item.variantKey ?? null}
                variantLabel={item.variantLabel ?? null}
                configuration={item.configuration ?? null}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <FlexBox
          py="6rem"
          width="100%"
          borderRadius="12px"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          border="1px dashed"
          borderColor="gray.400">
          <SemiSpan color="text.muted" style={{ textAlign: "center", maxWidth: 480 }}>
            {searchTerm
              ? t("shop.empty.search", {
                  defaultMessage: "We couldn't find products for “{query}”.",
                  values: { query: searchTerm },
                })
              : selectedCategoryLabel
                ? t("shop.empty.category", {
                    defaultMessage: "We couldn't find products in {category}.",
                    values: { category: selectedCategoryLabel },
                  })
                : t("shop.empty.filters", {
                    defaultMessage: "No products match the current filters yet.",
                  })}
          </SemiSpan>
        </FlexBox>
      )}

      <FlexBox flexWrap="wrap" justifyContent="space-between" alignItems="center" my="4rem">
        <SemiSpan>
          {meta.total > 0
            ? renderProductCount(meta.page - 1, meta.pageSize, meta.total)
            : t("shop.empty.count", { defaultMessage: "Showing 0 products" })}
        </SemiSpan>
        <Pagination currentPage={meta.page} onChange={handlePageChange} pageCount={meta.totalPage} />
      </FlexBox>
    </Fragment>
  );
}

export default memo(SaleProducts);
