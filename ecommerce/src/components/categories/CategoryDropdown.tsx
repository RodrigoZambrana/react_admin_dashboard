"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import Box from "@component/Box";
import Card from "@component/Card";
import NavLink from "@component/nav-link";
import { SemiSpan } from "@component/Typography";
import CategoryMenuItem from "./CategoryMenuItem";
import { StyledCategoryDropdown } from "./styles";
import type { CategorySummary } from "@/types/storefront";
import { buildFallbackCategorySummaries } from "@/lib/storefront/category-utils";
import {
  buildShopCategoryHref,
  mapCategorySummariesToAccordionNodes,
  type AccordionMenuNode
} from "@/lib/storefront/menu-nodes";
import navigations from "@data/navigations";
import AccordionMenu from "@component/mobile-navigation/AccordionMenu";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";

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
  const router = useRouter();
  const pathname = usePathname();
  const fallbackCategories = useMemo(() => buildFallbackCategorySummaries(), []);
  const fallbackIcons = useMemo(() => navigations.map((item) => item.icon || "category"), []);
  const iconList = icons && icons.length ? icons : fallbackIcons;
  const pageType = resolvePageType(pathname);

  const categoryData = useMemo(
    () => (categories && categories.length > 0 ? categories : fallbackCategories),
    [categories, fallbackCategories]
  );
  const accordionItems = useMemo(
    () => mapCategorySummariesToAccordionNodes(categoryData, iconList),
    [categoryData, iconList]
  );
  const handleAccordionSelection = useCallback(
    (item: AccordionMenuNode) => {
      if (!item.href) {
        return;
      }

      void trackEvent({
        event_name: "cta_click",
        event_category: "engagement",
        tenant_id: env.clientSlug,
        page_type: pageType,
        component_type: "category_menu",
        component_id: "mobile_category_menu",
        cta_id: "navigation.category.select",
        cta_name: "category_select",
        cta_type: "primary",
        cta_context: "navigation",
        cta_location: "mobile_category_menu",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          category_name: item.title,
          category_href: item.href
        },
        data: {
          category_name: item.title,
          category_href: item.href
        }
      });

      router.push(item.href, { scroll: false });
      onNavigate?.();
    },
    [onNavigate, pageType, router]
  );

  if (interactionMode === "accordion") {
    return (
      <AccordionMenu
        items={accordionItems}
        onNavigate={onNavigate}
        onSelectItem={handleAccordionSelection}
        expandRootItemsByDefault={false}
      />
    );
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
