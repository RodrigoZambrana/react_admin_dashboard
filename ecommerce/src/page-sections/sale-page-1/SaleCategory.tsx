"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@component/Box";
import Chip from "@component/Chip";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import { H5 } from "@component/Typography";
import shadows from "@utils/themeShadows";
import { useTranslation } from "@/state/i18n-context";

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
  const [activeKey, setActiveKey] = useState<string>(selectedSlug ?? "__all__");

  useEffect(() => {
    setActiveKey(selectedSlug ?? "__all__");
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
    <Box mb="2rem" overflow="hidden">
      <FlexBox m="-0.75rem" flexWrap="wrap">
        {categories.map((item, ind) => {
          const categoryKey =
            item.slug ?? (item.title === "All" ? "__all__" : `__fallback:${ind}`);
          const isSelected = activeKey === categoryKey;
          return (
            <FlexBox
              key={item.slug ?? `${item.title}-${ind}`}
              m="0.75rem"
              flex="1 1 0"
              height="175px"
              minWidth="200px"
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
      </FlexBox>
    </Box>
  );
}
