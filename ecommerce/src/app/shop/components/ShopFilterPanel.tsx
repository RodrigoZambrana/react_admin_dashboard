"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";

import Card from "@component/Card";
import Box from "@component/Box";
import Icon from "@component/icon/Icon";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import TextField from "@component/text-field";
import Rating from "@component/rating";
import { Button } from "@component/buttons";
import { H5, H6, Paragraph, SemiSpan, Span } from "@component/Typography";
import TrackedButton from "@component/TrackedButton";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/state/i18n-context";
import { useCurrency } from "@/state/currency-context";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";
import { ALL_CATEGORY_SLUG, isAllCategorySlug } from "@/lib/storefront/category-slugs";

type SaleCategoryDefinition = {
  icon: string;
  title: string;
  slug?: string;
};

export type PriceFilter = {
  min?: number;
  max?: number;
  currency?: string;
};

export type ActiveFilters = {
  priceMin?: number;
  priceMax?: number;
  rating?: number;
};

type ShopFilterPanelProps = {
  categories: SaleCategoryDefinition[];
  selectedCategorySlug?: string;
  priceBounds: PriceFilter;
  activeFilters: ActiveFilters;
  onClose?: () => void;
};

const ratingOptions = [5, 4, 3, 2, 1];

const CategoryButton = styled(FlexBox)<{ $active: boolean }>`
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  align-items: center;
  cursor: pointer;
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary.main : theme.colors.gray[300])};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primary.light : "transparent")};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary.main};
    background-color: ${({ theme }) => theme.colors.primary[100]};
  }

  span {
    color: ${({ theme, $active }) => ($active ? theme.colors.primary.main : theme.colors.text.muted)};
  }
`;

const RatingOption = styled(FlexBox)<{ $active: boolean }>`
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  align-items: center;
  cursor: pointer;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary.main : "transparent")};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primary.light : theme.colors.gray[200])};
  transition: background-color 200ms ease, border-color 200ms ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary.light};
    border-color: ${({ theme }) => theme.colors.primary.main};
  }
`;

const ClearButton = styled(Button)`
  padding: 0.25rem 0.5rem;
  min-width: auto;
`;

const FilterHeader = styled(FlexBox)`
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
`;

export default function ShopFilterPanel({
  priceBounds,
  activeFilters,
  categories,
  onClose,
  selectedCategorySlug
}: ShopFilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslation();
  const { currency: activeCurrency, convertMoney, formatMoney } = useCurrency();
  const pageType = resolvePageType(pathname);
  const filterRef = useComponentTracking({
    pageType,
    componentType: "filter_panel",
    componentId: "shop_filter_panel",
    metadata: { source: "shop_listing" }
  });

  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const sourceCurrency = priceBounds.currency ?? "UYU";

  const toDisplayValue = useCallback(
    (value?: number) => {
      if (typeof value !== "number") return "";
      const converted = convertMoney({ amount: value, currency: sourceCurrency }, activeCurrency);
      return String(Math.round(converted.amount));
    },
    [activeCurrency, convertMoney, sourceCurrency]
  );

  const toSourceValue = useCallback(
    (value?: number) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
      const converted = convertMoney({ amount: value, currency: activeCurrency }, sourceCurrency);
      return Math.round(converted.amount);
    },
    [activeCurrency, convertMoney, sourceCurrency]
  );

  useEffect(() => {
    setMinValue(
      typeof activeFilters.priceMin === "number"
        ? toDisplayValue(activeFilters.priceMin)
        : priceBounds.min !== undefined
          ? toDisplayValue(priceBounds.min)
          : ""
    );
    setMaxValue(
      typeof activeFilters.priceMax === "number"
        ? toDisplayValue(activeFilters.priceMax)
        : priceBounds.max !== undefined
          ? toDisplayValue(priceBounds.max)
          : ""
    );
  }, [activeFilters.priceMax, activeFilters.priceMin, priceBounds.max, priceBounds.min, toDisplayValue]);

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
      if (onClose) onClose();
    },
    [onClose, pathname, router, searchParams]
  );

  const handleCategorySelect = useCallback(
    (slug?: string) => () => {
      const normalizedSlug = slug ?? undefined;
      if ((selectedCategorySlug ?? undefined) === normalizedSlug) {
        if (onClose) onClose();
        return;
      }
      updateQuery({ category: slug });
    },
    [onClose, selectedCategorySlug, updateQuery]
  );

  const handleRatingToggle = useCallback(
    (value: number) => () => {
      const nextValue = activeFilters.rating === value ? undefined : String(value);
      updateQuery({ rating: nextValue });
    },
    [activeFilters.rating, updateQuery]
  );

  const handleApplyPrice = useCallback(() => {
    const parsedMin = Number(minValue);
    const parsedMax = Number(maxValue);

    const sanitizedMin = Number.isFinite(parsedMin) ? toSourceValue(parsedMin) : undefined;
    const sanitizedMax = Number.isFinite(parsedMax) ? toSourceValue(parsedMax) : undefined;

    let nextMin = sanitizedMin;
    let nextMax = sanitizedMax;

    if (typeof nextMin === "number" && typeof nextMax === "number" && nextMin > nextMax) {
      [nextMin, nextMax] = [nextMax, nextMin];
    }

    updateQuery({
      priceMin: typeof nextMin === "number" ? String(nextMin) : undefined,
      priceMax: typeof nextMax === "number" ? String(nextMax) : undefined
    });
  }, [maxValue, minValue, toSourceValue, updateQuery]);

  const handleClearFilters = useCallback(() => {
    updateQuery({
      category: undefined,
      priceMin: undefined,
      priceMax: undefined,
      query: undefined,
      search: undefined,
      rating: undefined,
      sort: undefined
    });
  }, [updateQuery]);

  const formattedPriceRange = useMemo(() => {
    if (priceBounds.min === undefined || priceBounds.max === undefined) return null;
    return `${formatMoney({ amount: priceBounds.min, currency: sourceCurrency }, activeCurrency)} - ${formatMoney(
      { amount: priceBounds.max, currency: sourceCurrency },
      activeCurrency
    )}`;
  }, [activeCurrency, formatMoney, priceBounds.max, priceBounds.min, sourceCurrency]);

  return (
    <Card elevation={5} padding="1.5rem" borderRadius={12} ref={filterRef as never}>
      <FilterHeader>
        <FlexBox alignItems="center" gridGap="0.75rem">
          <IconAdjustmentsHorizontal size={20} />
          <H5 mb="0px">{t("Filters")}</H5>
        </FlexBox>

        <TrackedButton as={ClearButton} variant="text" color="primary" pageType={pageType} componentType="filter_panel" componentId="shop_filter_panel" eventName="filter_applied" ctaId="filters.clear" ctaName="clear_filters" ctaType="secondary" ctaContext="navigation" ctaLocation="filter_panel" metadata={{ filter_name: "clear_all" }} onTrackedClick={handleClearFilters}>
          {t("Clear all")}
        </TrackedButton>
      </FilterHeader>

      <Box mb="1.5rem">
        <H6 mb="0.75rem">{t("Categories")}</H6>
        <FlexBox flexDirection="column" gridGap="0.5rem">
          {categories.map((category, index) => {
            const isActive =
              isAllCategorySlug(selectedCategorySlug)
                ? category.slug === ALL_CATEGORY_SLUG
                : category.slug === selectedCategorySlug;
            const label = category.title;
            const iconName = category.icon || "filter-3";
            const categoryKey = category.slug ?? `${category.title}-${index}`;

            return (
              <TrackedButton
                as={CategoryButton}
                key={categoryKey}
                $active={isActive}
                gridGap="0.75rem"
                pageType={pageType}
                componentType="filter_panel"
                componentId="shop_filter_panel"
                eventName="filter_applied"
                ctaId="filters.category.select"
                ctaName="filter_category"
                ctaType="primary"
                ctaContext="navigation"
                ctaLocation="filter_panel"
                metadata={{ filter_name: "category", filter_value: category.slug ?? null }}
                onTrackedClick={handleCategorySelect(category.slug)}>
                <Icon size="20px" color={isActive ? "primary" : "secondary"}>
                  {iconName}
                </Icon>
                <Span fontWeight={isActive ? 600 : 500}>{t(label)}</Span>
              </TrackedButton>
            );
          })}
        </FlexBox>
      </Box>

      <Divider my="1.5rem" />

      <Box mb="1.5rem">
        <FlexBox alignItems="center" justifyContent="space-between" mb="0.75rem">
          <H6 mb="0px">{t("Price Range")}</H6>
          {formattedPriceRange ? (
            <Paragraph fontSize="12px" color="text.muted">
              {formattedPriceRange}
            </Paragraph>
          ) : null}
        </FlexBox>
        <FlexBox alignItems="center" gridGap="0.75rem">
          <TextField
            type="number"
            fullWidth
            value={minValue}
            onChange={(event) => setMinValue(event.target.value)}
            placeholder={priceBounds.min !== undefined ? toDisplayValue(priceBounds.min) : t("Min")}
            min={priceBounds.min !== undefined ? Number(toDisplayValue(priceBounds.min)) : undefined}
          />
          <SemiSpan color="text.muted">{t("to")}</SemiSpan>
          <TextField
            type="number"
            fullWidth
            value={maxValue}
            onChange={(event) => setMaxValue(event.target.value)}
            placeholder={priceBounds.max !== undefined ? toDisplayValue(priceBounds.max) : t("Max")}
            min={priceBounds.min !== undefined ? Number(toDisplayValue(priceBounds.min)) : undefined}
          />
        </FlexBox>
        <TrackedButton
          fullWidth
          mt="1rem"
          color="primary"
          variant="contained"
          pageType={pageType}
          componentType="filter_panel"
          componentId="shop_filter_panel"
          eventName="filter_applied"
          ctaId="filters.price.apply"
          ctaName="filter_price"
          ctaType="primary"
          ctaContext="navigation"
          ctaLocation="filter_panel"
          metadata={{ filter_name: "price", min: Number(minValue) || null, max: Number(maxValue) || null }}
          onTrackedClick={handleApplyPrice}
          disabled={priceBounds.min === undefined || priceBounds.max === undefined}>
          {t("common.apply", { defaultMessage: "Apply" })}
        </TrackedButton>
      </Box>

      <Divider my="1.5rem" />

      <Box>
        <H6 mb="0.75rem">{t("Customer Rating")}</H6>
        <FlexBox flexDirection="column" gridGap="0.5rem">
          {ratingOptions.map((option) => {
            const isActive = activeFilters.rating === option;
            return (
              <TrackedButton
                as={RatingOption}
                key={option}
                $active={isActive}
                gridGap="0.5rem"
                pageType={pageType}
                componentType="filter_panel"
                componentId="shop_filter_panel"
                eventName="filter_applied"
                ctaId="filters.rating.select"
                ctaName="filter_rating"
                ctaType="primary"
                ctaContext="navigation"
                ctaLocation="filter_panel"
                metadata={{ filter_name: "rating", filter_value: option }}
                onTrackedClick={handleRatingToggle(option)}>
                <Rating value={option} color="warn" outof={5} />
                <SemiSpan color="text.muted">
                  {t("{count} & up", { values: { count: option } })}
                </SemiSpan>
              </TrackedButton>
            );
          })}
        </FlexBox>
      </Box>
    </Card>
  );
}
