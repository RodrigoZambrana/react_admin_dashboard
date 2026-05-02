"use client";

import { useMemo } from "react";

import Box from "@component/Box";
import Card from "@component/Card";
import NavLink from "@component/nav-link";
import { SemiSpan } from "@component/Typography";
import CategoryMenuItem from "./CategoryMenuItem";
import { StyledCategoryDropdown } from "./styles";
import type { CategorySummary } from "@/types/storefront";
import { buildFallbackCategorySummaries } from "@/lib/storefront/category-utils";
import { buildShopCategoryHref, mapCategorySummariesToAccordionNodes } from "@/lib/storefront/menu-nodes";
import navigations from "@data/navigations";
import AccordionMenu from "@component/mobile-navigation/AccordionMenu";

// =========================================
type CategoryDropdownProps = {
  open: boolean;
  position?: "absolute" | "relative";
  categories?: CategorySummary[];
  icons?: string[];
  onNavigate?: () => void;
  interactionMode?: "hover" | "accordion";
};
// =========================================

export default function CategoryDropdown({
  open,
  position = "absolute",
  categories,
  icons,
  onNavigate,
  interactionMode = "hover",
}: CategoryDropdownProps) {
  const fallbackCategories = useMemo(() => buildFallbackCategorySummaries(), []);
  const fallbackIcons = useMemo(() => navigations.map((item) => item.icon || "category"), []);
  const iconList = icons && icons.length ? icons : fallbackIcons;

  const categoryData = useMemo(
    () => (categories && categories.length > 0 ? categories : fallbackCategories),
    [categories, fallbackCategories]
  );
  const accordionItems = useMemo(
    () => mapCategorySummariesToAccordionNodes(categoryData, iconList),
    [categoryData, iconList]
  );

  if (interactionMode === "accordion") {
    return <AccordionMenu items={accordionItems} onNavigate={onNavigate} />;
  }

  return (
    <StyledCategoryDropdown open={open} position={position}>
      {categoryData.map((category, index) => {
        const iconName = iconList[index % iconList.length] ?? "category";
        const childCategories = Array.isArray(category.children) ? category.children : [];
        const categoryKey = String(category.id ?? category.slug ?? index);

        return (
          <CategoryMenuItem
            key={categoryKey}
            href={buildShopCategoryHref(category.slug)}
            icon={iconName}
            title={category.name}
            caret={childCategories.length > 0}
            onNavigate={childCategories.length === 0 ? onNavigate : undefined}>
            {childCategories.length > 0 ? (
              <div className="mega-menu">
                <Card ml="1rem" py="0.5rem" boxShadow="regular" overflow="hidden" borderRadius={8}>
                  <Box px="1.25rem" py="0.875rem" className="mega-menu-content">
                    <div className="mega-menu-list">
                      {childCategories.map((item, ind) => {
                        const childKey = String(item.id ?? item.slug ?? ind);
                        const subCategories = Array.isArray(item.children) ? item.children : [];

                        return (
                          <div key={childKey} className="mega-menu-item">
                            {item.slug ? (
                              <NavLink className="title-link" href={buildShopCategoryHref(item.slug)}>
                                {item.name}
                              </NavLink>
                            ) : (
                              <SemiSpan className="title-link">{item.name}</SemiSpan>
                            )}

                            {subCategories.length > 0 ? (
                              <div className="mega-menu-subcategories">
                                {subCategories.map((sub, subIndex) => {
                                  const subKey = String(sub.id ?? sub.slug ?? `${childKey}-${subIndex}`);
                                  return (
                                    <NavLink
                                      key={subKey}
                                      className="child-link"
                                      href={buildShopCategoryHref(sub.slug)}
                                      onClick={onNavigate}>
                                      {sub.name}
                                    </NavLink>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </Box>
                </Card>
              </div>
            ) : null}
          </CategoryMenuItem>
        );
      })}
    </StyledCategoryDropdown>
  );
}
