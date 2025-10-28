"use client";

import { Fragment, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Pagination from "@component/pagination";
import { SemiSpan } from "@component/Typography";
import { ProductCard1 } from "@component/product-cards";
import { renderProductCount } from "@utils/utils";
import Product from "@models/product.model";
import { Meta } from "interfaces";

// ==============================================================
interface Props {
  meta: Meta;
  products: Product[];
  selectedCategorySlug?: string;
}
// ==============================================================

export default function SaleProducts({ products, meta, selectedCategorySlug }: Props) {
  const { push } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasProducts = products.length > 0;

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
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
            <Grid item lg={3} md={4} sm={6} xs={12} key={item.slug}>
              <ProductCard1
                id={item.id}
                slug={item.slug}
                price={item.salePrice ?? item.price}
                basePrice={item.basePrice}
                currencyCode={item.currency}
                title={item.title}
                off={item.discount}
                images={item.images}
                imgUrl={item.thumbnail}
                rating={item.rating || 4}
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
          <SemiSpan color="text.muted">No products match your filters yet.</SemiSpan>
        </FlexBox>
      )}

      <FlexBox flexWrap="wrap" justifyContent="space-between" alignItems="center" my="4rem">
        <SemiSpan>
          {meta.total > 0
            ? renderProductCount(meta.page - 1, meta.pageSize, meta.total)
            : "Showing 0 products"}
        </SemiSpan>
        <Pagination currentPage={meta.page} onChange={handlePageChange} pageCount={meta.totalPage} />
      </FlexBox>
    </Fragment>
  );
}
