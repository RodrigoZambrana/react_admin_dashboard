"use client";

import { useCallback, useState } from "react";
import styled from "styled-components";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import Sidenav from "@component/sidenav/Sidenav";
import { Button } from "@component/buttons";
import FlexBox from "@component/FlexBox";
import { H6, Paragraph } from "@component/Typography";

import SaleProducts from "@sections/sale-page-1/SaleProducts";

import ShopFilterPanel, { ActiveFilters, PriceFilter } from "./ShopFilterPanel";

import type Product from "@models/product.model";
import type { Meta } from "interfaces";

type SaleCategoryDefinition = {
  icon: string;
  title: string;
  slug?: string;
};

type ShopProductAreaProps = {
  products: Product[];
  meta: Meta;
  selectedCategorySlug?: string;
  categories: SaleCategoryDefinition[];
  filters: {
    priceBounds: PriceFilter;
    active: ActiveFilters;
  };
};

const DesktopFilterWrapper = styled(Box)`
  display: none;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    display: block;
  }
`;

const MobileFilterButton = styled(Button)`
  position: fixed;
  right: 1.5rem;
  bottom: 5.5rem;
  border-radius: 999px;
  box-shadow: ${({ theme }) => theme.shadows[3]};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  z-index: 1202;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    display: none;
  }
`;

const DrawerHeader = styled(FlexBox)`
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

export default function ShopProductArea({
  products,
  meta,
  filters,
  categories,
  selectedCategorySlug
}: ShopProductAreaProps) {
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const handleOpenDrawer = useCallback(() => setDrawerOpen(true), []);
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      <Grid container spacing={6}>
        <Grid item lg={3} md={4} xs={12}>
          <DesktopFilterWrapper position="sticky" top="100px">
            <ShopFilterPanel
              categories={categories}
              priceBounds={filters.priceBounds}
              activeFilters={filters.active}
              selectedCategorySlug={selectedCategorySlug}
            />
          </DesktopFilterWrapper>
        </Grid>

        <Grid item lg={9} md={8} xs={12}>
          <SaleProducts products={products} meta={meta} selectedCategorySlug={selectedCategorySlug} />
        </Grid>
      </Grid>

      <Sidenav
        width={340}
        scroll
        open={isDrawerOpen}
        position="left"
        onClose={handleCloseDrawer}
        handle={
          <MobileFilterButton color="primary" variant="contained" onClick={handleOpenDrawer}>
            <IconAdjustmentsHorizontal size={20} />
            Filters
          </MobileFilterButton>
        }>
        <DrawerHeader>
          <H6 mb="0">Filters</H6>
          <Paragraph
            fontSize="12px"
            color="primary.main"
            style={{ cursor: "pointer" }}
            onClick={handleCloseDrawer}>
            Close
          </Paragraph>
        </DrawerHeader>

        <ShopFilterPanel
          categories={categories}
          priceBounds={filters.priceBounds}
          activeFilters={filters.active}
          selectedCategorySlug={selectedCategorySlug}
          onClose={handleCloseDrawer}
        />
      </Sidenav>
    </>
  );
}
