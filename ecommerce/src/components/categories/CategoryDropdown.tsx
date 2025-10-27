"use client";

import { useMemo } from "react";
import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";

import Box from "@component/Box";
import Icon from "@component/icon/Icon";
import { Span } from "@component/Typography";
import CategoryMenuItem from "./CategoryMenuItem";
import { StyledCategoryDropdown } from "./styles";
import type { CategorySummary } from "@/types/storefront";
import { buildFallbackCategorySummaries } from "@/lib/storefront/category-utils";
import navigations from "@data/navigations";

// =========================================
type CategoryDropdownProps = {
  open: boolean;
  position?: "absolute" | "relative";
  categories?: CategorySummary[];
  icons?: string[];
};
// =========================================

export default function CategoryDropdown({
  open,
  position = "absolute",
  categories,
  icons
}: CategoryDropdownProps) {
  const fallbackCategories = useMemo(() => buildFallbackCategorySummaries(), []);
  const fallbackIcons = useMemo(() => navigations.map((item) => item.icon || "category"), []);
  const iconList = icons && icons.length ? icons : fallbackIcons;

  const categoryData = useMemo(
    () => (categories && categories.length > 0 ? categories : fallbackCategories),
    [categories, fallbackCategories]
  );

  return (
    <StyledCategoryDropdown open={open} position={position}>
      {categoryData.map((category, index) => {
        const iconName = iconList[index % iconList.length] ?? "category";
        const childCategories = Array.isArray(category.children) ? category.children : [];
        const categoryKey = String(category.id ?? category.slug ?? index);
        return (
          <CategoryMenuItem
            key={categoryKey}
            href={`/product/search/${encodeURIComponent(category.slug)}`}
            icon={iconName}
            title={category.name}
            caret={childCategories.length > 0}>
            {childCategories.length > 0 ? (
              <Box className="mega-menu" display="none" minWidth="220px" p="1rem">
                <Box display="flex" flexDirection="column" gridGap="0.5rem">
                  {childCategories.map((subCategory, subIndex) => {
                    const childSlug = subCategory.slug;
                    const subKey = String(
                      subCategory.id ?? childSlug ?? `${categoryKey}-${subIndex}`
                    );

                    const content = (
                      <>
                        <Span className="sub-category-title" color="text.muted" fontSize="14px">
                          {subCategory.name}
                        </Span>
                        <IconChevronRight size={14} stroke={1.5} className="sub-category-chevron" />
                      </>
                    );

                    if (!childSlug) {
                      return (
                        <div key={subKey} className="sub-category-static">
                          {content}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={subKey}
                        className="sub-category-link"
                        href={`/product/search/${encodeURIComponent(childSlug)}`}>
                        {content}
                      </Link>
                    );
                  })}
                </Box>
              </Box>
            ) : null}
          </CategoryMenuItem>
        );
      })}
    </StyledCategoryDropdown>
  );
}
