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

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/state/i18n-context";

type SaleCategoryDefinition = {
  icon: string;
  title: string;
  slug?: string;
};

export type PriceFilter = {
  min?: number;
  max?: number;
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

  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");

  useEffect(() => {
    setMinValue(
      typeof activeFilters.priceMin === "number"
        ? String(activeFilters.priceMin)
        : priceBounds.min !== undefined
          ? String(priceBounds.min)
          : ""
    );
    setMaxValue(
      typeof activeFilters.priceMax === "number"
        ? String(activeFilters.priceMax)
        : priceBounds.max !== undefined
          ? String(priceBounds.max)
          : ""
    );
  }, [activeFilters.priceMax, activeFilters.priceMin, priceBounds.max, priceBounds.min]);

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

    const sanitizedMin = Number.isFinite(parsedMin) ? parsedMin : undefined;
    const sanitizedMax = Number.isFinite(parsedMax) ? parsedMax : undefined;

    let nextMin = sanitizedMin;
    let nextMax = sanitizedMax;

    if (typeof nextMin === "number" && typeof nextMax === "number" && nextMin > nextMax) {
      [nextMin, nextMax] = [nextMax, nextMin];
    }

    updateQuery({
      priceMin: typeof nextMin === "number" ? String(nextMin) : undefined,
      priceMax: typeof nextMax === "number" ? String(nextMax) : undefined
    });
  }, [minValue, maxValue, updateQuery]);

  const handleClearFilters = useCallback(() => {
    updateQuery({ priceMin: undefined, priceMax: undefined, rating: undefined });
  }, [updateQuery]);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    []
  );

  const formattedPriceRange = useMemo(() => {
    if (priceBounds.min === undefined || priceBounds.max === undefined) return null;
    return `${currencyFormatter.format(priceBounds.min)} - ${currencyFormatter.format(priceBounds.max)}`;
  }, [currencyFormatter, priceBounds.max, priceBounds.min]);

  return (
    <Card elevation={5} padding="1.5rem" borderRadius={12}>
      <FilterHeader>
        <FlexBox alignItems="center" gridGap="0.75rem">
          <IconAdjustmentsHorizontal size={20} />
          <H5 mb="0px">{t("Filters")}</H5>
        </FlexBox>

        <ClearButton variant="text" color="primary" onClick={handleClearFilters}>
          {t("Clear all")}
        </ClearButton>
      </FilterHeader>

      <Box mb="1.5rem">
        <H6 mb="0.75rem">{t("Categories")}</H6>
        <FlexBox flexDirection="column" gridGap="0.5rem">
          {categories.map((category, index) => {
            const isActive =
              selectedCategorySlug === undefined
                ? category.slug === undefined
                : category.slug === selectedCategorySlug;
            const label = category.title;
            const iconName = category.icon || "filter-3";
            const categoryKey = category.slug ?? `${category.title}-${index}`;

            return (
              <CategoryButton
                key={categoryKey}
                $active={isActive}
                gridGap="0.75rem"
                onClick={handleCategorySelect(category.slug)}>
                <Icon size="20px" color={isActive ? "primary" : "secondary"}>
                  {iconName}
                </Icon>
                <Span fontWeight={isActive ? 600 : 500}>{t(label)}</Span>
              </CategoryButton>
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
            placeholder={priceBounds.min !== undefined ? String(priceBounds.min) : t("Min")}
            min={priceBounds.min ?? undefined}
          />
          <SemiSpan color="text.muted">{t("to")}</SemiSpan>
          <TextField
            type="number"
            fullWidth
            value={maxValue}
            onChange={(event) => setMaxValue(event.target.value)}
            placeholder={priceBounds.max !== undefined ? String(priceBounds.max) : t("Max")}
            min={priceBounds.min ?? undefined}
          />
        </FlexBox>
        <Button
          fullWidth
          mt="1rem"
          color="primary"
          variant="contained"
          onClick={handleApplyPrice}
          disabled={priceBounds.min === undefined || priceBounds.max === undefined}>
          {t("common.apply", { defaultMessage: "Apply" })}
        </Button>
      </Box>

      <Divider my="1.5rem" />

      <Box>
        <H6 mb="0.75rem">{t("Customer Rating")}</H6>
        <FlexBox flexDirection="column" gridGap="0.5rem">
          {ratingOptions.map((option) => {
            const isActive = activeFilters.rating === option;
            return (
              <RatingOption key={option} $active={isActive} gridGap="0.5rem" onClick={handleRatingToggle(option)}>
                <Rating value={option} color="warn" outof={5} />
                <SemiSpan color="text.muted">
                  {t("{count} & up", { values: { count: option } })}
                </SemiSpan>
              </RatingOption>
            );
          })}
        </FlexBox>
      </Box>
    </Card>
  );
}
