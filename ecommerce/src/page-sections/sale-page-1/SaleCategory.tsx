"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styled from "styled-components";
import Box from "@component/Box";
import Chip from "@component/Chip";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import { H3, H5, Paragraph } from "@component/Typography";
import shadows from "@utils/themeShadows";
import { useTranslation } from "@/state/i18n-context";
import { ALL_CATEGORY_SLUG } from "@/lib/storefront/category-slugs";
import { resolvePageType } from "@/lib/analytics/pageType";
import TrackedButton from "@/components/TrackedButton";

const SectionHeader = styled(FlexBox)`
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;

  @media (max-width: 900px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const ActionRow = styled(FlexBox)`
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const CategoryGrid = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

// ==============================================================
interface SaleCategoryProps {
  categories: {
    icon: string;
    title: string;
    slug?: string;
  }[];
  selectedSlug?: string;
}
// ==============================================================

export default function SaleCategory({ categories, selectedSlug }: SaleCategoryProps) {
  const t = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeKey, setActiveKey] = useState<string>(selectedSlug ?? ALL_CATEGORY_SLUG);
  const pageType = resolvePageType(pathname);

  useEffect(() => {
    setActiveKey(selectedSlug ?? ALL_CATEGORY_SLUG);
  }, [selectedSlug]);

  const handleCategoryClick = useCallback(
    (categorySlug: string | undefined, fallbackKey: string) => () => {
      if (fallbackKey === activeKey) return;
      setActiveKey(fallbackKey);

      if (!pathname) return;

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (categorySlug) {
        params.set("category", categorySlug);
      } else {
        params.delete("category");
      }
      params.delete("page");

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [activeKey, pathname, router, searchParams]
  );

  return (
    <Box mb="2rem">
      <SectionHeader>
        <Box maxWidth="640px">
          <H3 mb="0.35rem">
            {t("shop.categorySection.title", {
              defaultMessage: "Explorá nuestra tienda por categoría"
            })}
          </H3>
          <Paragraph color="text.muted" mb="0">
            {t("shop.categorySection.body", {
              defaultMessage:
                "Explorá la tienda o pedí asesoramiento para encontrar la mejor opción para tu proyecto."
            })}
          </Paragraph>
        </Box>

        <ActionRow>
          <TrackedButton
            color="primary"
            variant="outlined"
            pageType={pageType}
            componentType="category_section"
            componentId="shop_category_overview"
            ctaId="shop.category_section.explore_store"
            ctaName="explore_store"
            ctaType="secondary"
            ctaContext="navigation"
            ctaLocation="shop_category_section"
            onTrackedClick={() => router.push("/shop", { scroll: false })}
          >
            {t("shop.categorySection.exploreCta", {
              defaultMessage: "Explorá la tienda"
            })}
          </TrackedButton>

          <TrackedButton
            color="primary"
            variant="contained"
            pageType={pageType}
            componentType="category_section"
            componentId="shop_category_overview"
            ctaId="support.request_advice"
            ctaName="request_advice"
            ctaType="primary"
            ctaContext="content"
            ctaLocation="shop_category_section"
            onTrackedClick={() => router.push("/contacto")}
          >
            {t("shop.categorySection.adviceCta", {
              defaultMessage: "Pedir asesoramiento"
            })}
          </TrackedButton>
        </ActionRow>
      </SectionHeader>

      <CategoryGrid>
        {categories.map((item, ind) => {
          const categoryKey = item.slug ?? `__fallback:${ind}`;
          const isSelected = activeKey === categoryKey;
          return (
            <FlexBox
              key={item.slug ?? `${item.title}-${ind}`}
              height="175px"
              minWidth="0"
              borderRadius="12px"
              border="1px solid"
              alignItems="center"
              position="relative"
              flexDirection="column"
              borderColor="gray.400"
              justifyContent="center"
              onClick={handleCategoryClick(item.slug, categoryKey)}
              bg={isSelected ? "white" : "transparent"}
              style={{
                cursor: "pointer",
                transition: "all 250ms ease-in-out"
              }}>
              <Icon size="44px" color={isSelected ? "primary" : "secondary"}>
                {item.icon}
              </Icon>

              <H5 color={isSelected ? "primary.main" : "inherit"}>
                {t(item.title, { defaultMessage: item.title })}
              </H5>

              <Chip
                top="1rem"
                right="1rem"
                p="5px 10px"
                fontSize="10px"
                fontWeight="600"
                position="absolute"
                color={isSelected ? "white" : "inherit"}
                bg={isSelected ? "primary.main" : "gray.300"}
                boxShadow={isSelected ? shadows.badge : "inherit"}>
                {t("shop.categoryCard.cta", { defaultMessage: "Browse category" })}
              </Chip>
            </FlexBox>
          );
        })}
      </CategoryGrid>
    </Box>
  );
}
