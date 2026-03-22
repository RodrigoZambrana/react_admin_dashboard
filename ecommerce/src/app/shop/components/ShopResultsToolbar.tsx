"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "styled-components";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";

import Box from "@component/Box";
import Card from "@component/Card";
import Select from "@component/Select";
import FlexBox from "@component/FlexBox";
import { IconButton } from "@component/buttons";
import { H5, Paragraph } from "@component/Typography";
import { useTranslation } from "@/state/i18n-context";

type ShopResultsToolbarProps = {
  total: number;
  searchTerm?: string;
  selectedCategoryLabel?: string;
  currentSort?: string;
  currentView: "grid" | "list";
};

type SortOption = {
  label: string;
  value: string;
};

export default function ShopResultsToolbar({
  total,
  searchTerm,
  selectedCategoryLabel,
  currentSort,
  currentView,
}: ShopResultsToolbarProps) {
  const t = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortOptions = useMemo<SortOption[]>(
    () => [
      {
        label: t("Relevance", { defaultMessage: "Relevance" }),
        value: "relevance",
      },
      {
        label: t("Newest", { defaultMessage: "Newest" }),
        value: "newest",
      },
      {
        label: t("Price: Low to high", { defaultMessage: "Price: Low to high" }),
        value: "price-asc",
      },
      {
        label: t("Price: High to low", { defaultMessage: "Price: High to low" }),
        value: "price-desc",
      },
    ],
    [t]
  );

  const selectedSort = useMemo(
    () => sortOptions.find((option) => option.value === (currentSort ?? "relevance")) ?? sortOptions[0],
    [currentSort, sortOptions]
  );

  const hasResultsContext = useMemo(() => {
    const params = searchParams ? new URLSearchParams(searchParams.toString()) : null;
    if (!params) {
      return Boolean(searchTerm || selectedCategoryLabel);
    }

    const hasSearch =
      params.has("query") ||
      params.has("search");
    const hasCategory = params.has("category");
    const hasPrice =
      params.has("priceMin") ||
      params.has("priceMax") ||
      params.has("minPrice") ||
      params.has("maxPrice") ||
      params.has("price_min") ||
      params.has("price_max");
    const hasRating = params.has("rating");
    const hasSort = (params.get("sort") ?? "").trim() !== "" && params.get("sort") !== "relevance";

    return hasSearch || hasCategory || hasPrice || hasRating || hasSort;
  }, [searchParams, searchTerm, selectedCategoryLabel]);

  const heading = useMemo(() => {
    if (searchTerm) {
      return t("shop.results.searching", {
        defaultMessage: "Searching for “{query}”",
        values: { query: searchTerm },
      });
    }

    if (selectedCategoryLabel) {
      return t("shop.results.category", {
        defaultMessage: "Browsing “{category}”",
        values: { category: selectedCategoryLabel },
      });
    }

    return null;
  }, [searchTerm, selectedCategoryLabel, t]);

  const resultsText = useMemo(
    () =>
      t("shop.results.count", {
        defaultMessage: "{count} results found",
        values: { count: total },
      }),
    [t, total]
  );

  const updateQuery = useCallback(
    (updates: Record<string, string | undefined>) => {
      if (!pathname) return;

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      params.delete("page");

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleSortChange = useCallback(
    (option: SortOption | null) => {
      const nextValue = option?.value ?? "relevance";
      updateQuery({ sort: nextValue === "relevance" ? undefined : nextValue });
    },
    [updateQuery]
  );

  const handleViewChange = useCallback(
    (view: "grid" | "list") => () => {
      updateQuery({ view: view === "grid" ? undefined : view });
    },
    [updateQuery]
  );

  return (
    <FlexBox
      as={Card}
      mb="30px"
      p="1.25rem"
      elevation={5}
      flexWrap="wrap"
      borderRadius={12}
      alignItems="center"
      justifyContent="space-between"
      style={{ gap: "1rem" }}>
      <Box>
        {heading ? <H5>{heading}</H5> : null}
        {hasResultsContext ? <Paragraph color="text.muted">{resultsText}</Paragraph> : null}
      </Box>

      <FlexBox alignItems="center" flexWrap="wrap" style={{ gap: "0.75rem 1rem" }}>
        <Paragraph color="text.muted">
          {t("shop.results.sortBy", { defaultMessage: "Sort by:" })}
        </Paragraph>

        <Box minWidth="220px">
            <Select
              value={selectedSort}
            options={sortOptions}
            onChange={(option) => handleSortChange(option as SortOption | null)}
            placeholder="Sort by"
            isSearchable={false}
          />
        </Box>

        <Paragraph color="text.muted">
          {t("shop.results.view", { defaultMessage: "View:" })}
        </Paragraph>

        <IconButton onClick={handleViewChange("grid")} aria-label={t("shop.results.viewGrid", { defaultMessage: "Grid view" })}>
          <IconLayoutGrid
            size={22}
            color={currentView === "grid" ? theme.colors.primary.main : "currentColor"}
          />
        </IconButton>

        <IconButton onClick={handleViewChange("list")} aria-label={t("shop.results.viewList", { defaultMessage: "List view" })}>
          <IconList
            size={22}
            color={currentView === "list" ? theme.colors.primary.main : "currentColor"}
          />
        </IconButton>
      </FlexBox>
    </FlexBox>
  );
}
