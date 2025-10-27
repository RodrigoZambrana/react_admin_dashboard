"use client";

import { Fragment, useCallback, useState } from "react";
import { useTheme } from "styled-components";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";

import Box from "@component/Box";
import Card from "@component/Card";
import Select from "@component/Select";
import Icon from "@component/icon/Icon";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import { IconButton } from "@component/buttons";
import Sidenav from "@component/sidenav/Sidenav";
import { H5, Paragraph } from "@component/Typography";
import ProductGridView from "@component/products/ProductCard1List";
import ProductListView from "@component/products/ProductCard9List";
import ProductFilterCard from "@component/products/ProductFilterCard";
import useWindowSize from "@hook/useWindowSize";
import db from "@data/db";

// ==============================================================
interface Props {
  sortOptions: { label: string; value: string }[];
}
// ==============================================================

export default function SearchResult({ sortOptions }: Props) {
  const theme = useTheme();
  const width = useWindowSize();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const handleOpenSidenav = useCallback(() => setOpen(true), []);
  const handleCloseSidenav = useCallback(() => setOpen(false), []);

  const isTablet = width < 1025;
  const toggleView = useCallback((v: any) => () => setView(v), []);

  return (
    <Fragment>
      <FlexBox
        as={Card}
        mb="55px"
        p="1.25rem"
        elevation={5}
        flexWrap="wrap"
        borderRadius={12}
        alignItems="center"
        justifyContent="space-between">
        <div>
          <H5>Searching for “ mobile phone ”</H5>
          <Paragraph color="text.muted">48 results found</Paragraph>
        </div>

        <FlexBox alignItems="center" flexWrap="wrap">
          <Paragraph color="text.muted" mr="1rem">
            Short by:
          </Paragraph>

          <Box flex="1 1 0" mr="1.75rem" minWidth="150px">
            <Select placeholder="Short by" defaultValue={sortOptions[0]} options={sortOptions} />
          </Box>

          <Paragraph color="text.muted" mr="0.5rem">
            View:
          </Paragraph>

          <IconButton onClick={toggleView("grid")}>
            <IconLayoutGrid
              size={22}
              color={view === "grid" ? theme.colors.primary.main : "currentColor"}
            />
          </IconButton>

          <IconButton onClick={toggleView("list")}>
            <IconList
              size={22}
              color={view === "list" ? theme.colors.primary.main : "currentColor"}
            />
          </IconButton>

          {isTablet && (
            <Sidenav
              position="left"
              open={open}
              scroll={true}
              onClose={handleCloseSidenav}
              handle={
                <IconButton onClick={handleOpenSidenav}>
                  <Icon>options</Icon>
                </IconButton>
              }>
              <ProductFilterCard />
            </Sidenav>
          )}
        </FlexBox>
      </FlexBox>

      <Grid container spacing={6}>
        <Grid item lg={3} xs={12}>
          <ProductFilterCard />
        </Grid>

        <Grid item lg={9} xs={12}>
          {view === "grid" ? (
            <ProductGridView products={db.slice(95, 104)} />
          ) : (
            <ProductListView products={db.slice(95, 104)} />
          )}
        </Grid>
      </Grid>
    </Fragment>
  );
}
