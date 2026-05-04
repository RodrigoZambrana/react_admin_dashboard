"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import debounce from "lodash/debounce";

import Menu from "@component/menu/Menu";
import Card from "@component/Card";
import MenuItem from "@component/MenuItem";
import { Span } from "@component/Typography";
import TextField from "@component/text-field";
import StyledSearchBox from "./styled";
import CategoryNavigationRow from "@component/categories/CategoryNavigationRow";
import Box from "@component/Box";
import AccordionMenu from "@component/mobile-navigation/AccordionMenu";
import useWindowSize from "@hook/useWindowSize";
import { StyledCategoryMenuItem } from "@component/categories/styles";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { CategorySummary, ProductSummary } from "@/types/storefront";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { useTranslation } from "@/state/i18n-context";
import {
  buildSearchCategoryOptions,
  filterSearchCategoryOptions,
  findMatchingSearchCategories,
  getProductSearchContext,
  getSearchCategoryContext,
  normalizeSearchValue,
} from "@/lib/storefront/search-utils";
import {
  type AccordionMenuNode
} from "@/lib/storefront/menu-nodes";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";
import { ALL_CATEGORY_SLUG, isAllCategorySlug } from "@/lib/storefront/category-slugs";

const dropdownVariants = {
  hidden: {
    y: -10,
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    y: 0,
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    y: -10,
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

type CategoryOption = ReturnType<typeof buildSearchCategoryOptions>[number];

const DEFAULT_CATEGORY: CategoryOption = {
  key: ALL_CATEGORY_SLUG,
  label: "search.categories.all",
  slug: ALL_CATEGORY_SLUG,
  depth: 0,
  lineage: [],
  lineageLabels: [],
};

const buildSearchAccordionNodes = ({
  categories,
  selectParentLabel,
}: {
  categories: CategorySummary[];
  selectParentLabel: (categoryName: string) => string;
}): AccordionMenuNode[] => {
  const mapNodes = (items: CategorySummary[], depth = 0): AccordionMenuNode[] =>
    items.map((category, index) => {
      const hasChildren = (category.children?.length ?? 0) > 0;
      const nestedChildren = hasChildren ? mapNodes(category.children ?? [], depth + 1) : undefined;

      return {
        key: `${depth}:${index}:${category.slug ?? category.id ?? category.name}`,
        title: category.name,
        href: hasChildren ? undefined : buildShopSearchHref("", category.slug),
        icon: depth === 0 ? "category" : undefined,
        children: hasChildren
          ? [
              {
                key: `${depth}:${index}:${category.slug ?? category.id ?? category.name}:self`,
                title: selectParentLabel(category.name),
                href: buildShopSearchHref("", category.slug),
              },
              ...(nestedChildren ?? []),
            ]
          : undefined,
      };
    });

  return mapNodes(categories);
};

const buildShopSearchHref = (query: string, categorySlug?: string) => {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) {
    params.set("query", trimmed);
  }
  if (categorySlug) {
    params.set("category", categorySlug);
  }
  const search = params.toString();
  return search ? `/shop?${search}` : "/shop";
};

export default function SearchInputWithCategory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const width = useWindowSize();
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([DEFAULT_CATEGORY]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption>(DEFAULT_CATEGORY);
  const { formatMoney: formatStorefrontMoney } = useMoneyFormatter();
  const t = useTranslation();
  const pageType = resolvePageType(pathname);
  const searchRef = useComponentTracking({
    pageType,
    componentType: "search_input",
    componentId: "search_input_with_category",
    metadata: { variant: "with_category" }
  });

  const latestRequestRef = useRef(0);
  const routeKey = `${pathname ?? ""}?${searchParams?.toString() ?? ""}`;

  const fetchCategories = useCallback(async () => {
    try {
      const data = await StorefrontApi.listCategories();
      setCategories(data);
      const options = buildSearchCategoryOptions(data);
      setCategoryOptions(options.length > 0 ? [DEFAULT_CATEGORY, ...options] : [DEFAULT_CATEGORY]);
    } catch (error) {
      if (!isApiError(error)) {
        console.warn("[search] Failed to load categories from API, falling back to defaults.", error);
      }
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const currentCategorySlug = searchParams?.get("category") ?? undefined;
    if (isAllCategorySlug(currentCategorySlug)) {
      setSelectedCategory(DEFAULT_CATEGORY);
      return;
    }

    const matchingOption = categoryOptions.find((option) => option.slug === currentCategorySlug);
    if (matchingOption) {
      setSelectedCategory(matchingOption);
    }
  }, [categoryOptions, searchParams]);

  const scopedCategoryOptions = useMemo(() => {
    return filterSearchCategoryOptions(categoryOptions, selectedCategory.slug);
  }, [categoryOptions, selectedCategory.slug]);

  const matchedCategories = useMemo(() => {
    return findMatchingSearchCategories(scopedCategoryOptions, query).slice(0, 5);
  }, [query, scopedCategoryOptions]);
  const defaultCategoryLabel = t("search.categories.all", {
    defaultMessage: "Todas las categorías",
  });
  const selectParentCategoryLabel = useCallback(
    (categoryName: string) =>
      t("search.categories.viewAllIn", {
        defaultMessage: "All in {category}",
        values: { category: categoryName },
      }),
    [t]
  );
  const categoryAccordionItems = useMemo<AccordionMenuNode[]>(
    () => [
      {
        key: DEFAULT_CATEGORY.key,
        title: defaultCategoryLabel,
        href: buildShopSearchHref("", DEFAULT_CATEGORY.slug),
        icon: "category"
      },
      ...buildSearchAccordionNodes({
        categories,
        selectParentLabel: selectParentCategoryLabel,
      })
    ],
    [categories, defaultCategoryLabel, selectParentCategoryLabel],
  );

  const debouncedSearch = useMemo(
    () =>
      debounce(async (term: string, categorySlug?: string) => {
        const trimmed = term.trim();
        if (!trimmed) {
          setResults([]);
          setIsSearching(false);
          return;
        }

        const requestId = ++latestRequestRef.current;
        setIsSearching(true);

        try {
          const response = await StorefrontApi.listProducts({
            search: trimmed,
            categorySlug,
            pageSize: 6,
          });

          if (latestRequestRef.current === requestId) {
            setResults(response.data);
          }
        } catch (error) {
          if (latestRequestRef.current === requestId) {
            setResults([]);
          }
          if (!isApiError(error)) {
            console.warn("[search] Failed to fetch products.", error);
          }
        } finally {
          if (latestRequestRef.current === requestId) {
            setIsSearching(false);
          }
        }
      }, 250),
    [],
  );

  useEffect(
    () => () => {
      debouncedSearch.cancel();
    },
    [debouncedSearch],
  );

  const closeDropdown = useCallback(() => {
    setResults([]);
    setIsSearching(false);
  }, []);

  const handleCategorySelectBySlug = useCallback(
    (slug?: string | null) => {
      const nextSelection = slug
        ? categoryOptions.find((option) => option.slug === slug) ?? DEFAULT_CATEGORY
        : DEFAULT_CATEGORY;
      void trackEvent({
        event_name: "cta_click",
        event_category: "engagement",
        tenant_id: env.clientSlug,
        page_type: pageType,
        component_type: "search_input",
        component_id: "search_input_with_category",
        cta_id: "search.category.select",
        cta_name: "open_category",
        cta_type: "secondary",
        cta_context: "navigation",
        cta_location: "search_bar",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          category_slug: nextSelection.slug ?? null,
          category_label: isAllCategorySlug(nextSelection.slug) ? defaultCategoryLabel : nextSelection.label
        },
        data: {
          category_slug: nextSelection.slug ?? null,
          category_label: isAllCategorySlug(nextSelection.slug) ? defaultCategoryLabel : nextSelection.label
        },
      });
      setSelectedCategory(nextSelection);
      if (query.trim()) {
        debouncedSearch(query, nextSelection.slug);
      }
    },
    [categoryOptions, debouncedSearch, defaultCategoryLabel, pageType, query],
  );

  const handleAccordionCategorySelect = useCallback(
    (item: { href?: string }) => {
      if (!item.href) {
        return;
      }

      const target = new URL(item.href, "http://localhost");
      handleCategorySelectBySlug(target.searchParams.get("category"));
    },
    [handleCategorySelectBySlug],
  );

  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setQuery(value);

      if (!value.trim()) {
        debouncedSearch.cancel();
        closeDropdown();
        return;
      }

      debouncedSearch(value, selectedCategory.slug);
    },
    [closeDropdown, debouncedSearch, selectedCategory.slug],
  );

  const handleDocumentClick = useCallback(() => {
    closeDropdown();
  }, [closeDropdown]);

  useEffect(() => {
    window.addEventListener("click", handleDocumentClick);
    return () => window.removeEventListener("click", handleDocumentClick);
  }, [handleDocumentClick]);

  useEffect(() => {
    closeDropdown();
    setQuery("");
  }, [closeDropdown, routeKey]);

  const handleSearchBoxClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleResultNavigation = useCallback(() => {
    closeDropdown();
    setQuery("");
  }, [closeDropdown]);

  const navigateFromQuery = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      router.push(buildShopSearchHref("", selectedCategory.slug));
      closeDropdown();
      return;
    }

    const normalizedQuery = normalizeSearchValue(trimmed);
    const exactCategoryMatch = matchedCategories.find((category) => {
      const label = normalizeSearchValue(category.label);
      const slug = normalizeSearchValue(category.slug ?? "");
      return label === normalizedQuery || slug === normalizedQuery;
    });

    const targetHref = exactCategoryMatch?.slug
      ? buildShopSearchHref("", exactCategoryMatch.slug)
      : buildShopSearchHref(trimmed, selectedCategory.slug);

    void trackEvent({
      event_name: "search",
      event_category: "navigation",
      tenant_id: env.clientSlug,
      page_type: pageType,
      component_type: "search_input",
      component_id: "search_input_with_category",
      cta_id: "search.submit",
      cta_name: "search",
      cta_type: "primary",
      cta_context: "navigation",
      cta_location: "search_bar",
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        query: trimmed,
        query_normalized: normalizeSearchValue(trimmed),
        category_slug: selectedCategory.slug ?? null,
        matched_category: exactCategoryMatch?.slug ?? null,
        search_stage: "intent",
        search_source: "search_input_with_category",
      },
      data: {
        query: trimmed,
        query_normalized: normalizeSearchValue(trimmed),
        category_slug: selectedCategory.slug ?? null,
        matched_category: exactCategoryMatch?.slug ?? null,
        search_stage: "intent",
        search_source: "search_input_with_category",
      },
    });

    router.push(targetHref);
    closeDropdown();
  }, [closeDropdown, matchedCategories, pageType, query, router, selectedCategory.slug]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      navigateFromQuery();
    },
    [navigateFromQuery],
  );

  const hasResults = results.length > 0 || matchedCategories.length > 0 || isSearching || query.trim().length > 0;
  const isDesktopCategorySelector = (width ?? 1200) >= 900;
  const selectedCategoryHref = buildShopSearchHref("", selectedCategory.slug);

  const isSelectedBranch = useCallback(
    (category: CategorySummary): boolean => {
      if (isAllCategorySlug(selectedCategory.slug)) {
        return false;
      }

      if (category.slug === selectedCategory.slug) {
        return true;
      }

      return (category.children ?? []).some((child) => isSelectedBranch(child));
    },
    [selectedCategory.slug],
  );

  return (
    <Box
      zIndex={99}
      position="relative"
      flex="1 1 0"
      maxWidth="670px"
      mx="auto"
      ref={searchRef as never}
      onClick={handleSearchBoxClick}>
      <form onSubmit={handleSubmit}>
        <StyledSearchBox>
          <button type="submit" className="search-trigger" aria-label={t("search.submit", { defaultMessage: "Search" })}>
            <IconSearch size={18} stroke={1.5} className="search-icon" />
          </button>

          <TextField
            fullWidth
            value={query}
            onChange={handleSearch}
            className="search-field"
            placeholder={t("search.placeholder", {
              defaultMessage: "Search products or categories",
            })}
          />

          <Menu
            direction="right"
            closeOnContentClick={!isDesktopCategorySelector}
            className="category-dropdown"
            handler={(openMenu) => (
              <button type="button" className="dropdown-handler" onClick={openMenu}>
                <span>
                  {!isAllCategorySlug(selectedCategory.slug)
                    ? t(selectedCategory.label, { defaultMessage: selectedCategory.label })
                    : defaultCategoryLabel}
                </span>
                <IconChevronDown size={18} stroke={1.5} />
              </button>
            )}>
            {isDesktopCategorySelector ? (
              <Box>
                <StyledCategoryMenuItem key="all-categories-option">
                  <CategoryNavigationRow
                    icon="category"
                    title={defaultCategoryLabel}
                    active={isAllCategorySlug(selectedCategory.slug)}
                    showChevron={false}
                    minWidth="220px"
                    onClick={() => handleCategorySelectBySlug(undefined)}
                  />
                </StyledCategoryMenuItem>
                {categories.map((category, index) => {
                  const childCategories = category.children ?? [];
                  const isActive = isSelectedBranch(category);

                  return (
                    <StyledCategoryMenuItem key={category.id ?? category.slug ?? index}>
                      <CategoryNavigationRow
                        icon="category"
                        title={t(category.name, { defaultMessage: category.name })}
                        caret={childCategories.length > 0}
                        showChevron={childCategories.length > 0}
                        active={isActive}
                        minWidth="220px"
                        onClick={() => handleCategorySelectBySlug(category.slug)}
                      />

                      {childCategories.length > 0 ? (
                        <Box className="mega-menu" display="none" minWidth="220px" p="1rem">
                          <Box display="flex" flexDirection="column" gridGap="0.5rem">
                            {childCategories.map((subCategory, subIndex) => {
                              const isSubActive = selectedCategory.slug === subCategory.slug;
                              const subKey = String(
                                subCategory.id ?? subCategory.slug ?? `${category.slug ?? category.id}-${subIndex}`,
                              );

                              return (
                                <button
                                  type="button"
                                  key={subKey}
                                  className={`sub-category-link${isSubActive ? " active" : ""}`}
                                  onClick={() => handleCategorySelectBySlug(subCategory.slug)}
                                >
                                  <Span className="sub-category-title" color="text.muted" fontSize="14px">
                                    {t(subCategory.name, { defaultMessage: subCategory.name })}
                                  </Span>
                                  <IconChevronDown size={14} stroke={1.5} className="sub-category-chevron" style={{ transform: "rotate(-90deg)" }} />
                                </button>
                              );
                            })}
                          </Box>
                        </Box>
                      ) : null}
                    </StyledCategoryMenuItem>
                  );
                })}
              </Box>
            ) : (
              <Box minWidth="240px">
                <AccordionMenu
                  items={categoryAccordionItems}
                  heading={t("Categories", { defaultMessage: "Categorías" })}
                  onSelectItem={handleAccordionCategorySelect}
                  selectedHref={selectedCategoryHref}
                  expandRootItemsByDefault={false}
                  parentRowAction="toggle"
                  reserveTrailingSpaceForLeafItems
                />
              </Box>
            )}
          </Menu>
        </StyledSearchBox>
      </form>

      <AnimatePresence>
        {hasResults && (
          <motion.div
            exit="exit"
            initial="hidden"
            animate="visible"
            variants={dropdownVariants}
            style={{
              top: "100%",
              zIndex: 99,
              width: "100%",
              position: "absolute",
            }}>
            <Card py="0.5rem" mt="0.25rem" boxShadow="large" borderRadius=".5rem">
              {isSearching ? (
                <MenuItem>
                  <Span fontSize="14px">{t("Searching…")}</Span>
                </MenuItem>
              ) : null}

              {!isSearching && matchedCategories.length > 0
                ? matchedCategories.map((category) => (
                    <Link
                      href={buildShopSearchHref("", category.slug)}
                      key={category.key}
                      onClick={handleResultNavigation}>
                      <CategoryNavigationRow
                        icon={category.depth > 0 ? "right-arrow-2" : "category"}
                        title={t(category.label, { defaultMessage: category.label })}
                        eyebrow={t("search.result.category", { defaultMessage: "Category" })}
                        description={getSearchCategoryContext(category)}
                        showChevron={false}
                        minWidth="100%"
                      />
                    </Link>
                  ))
                : null}

              {!isSearching
                ? results.map((product) => {
                    const price = product.salePrice ?? product.price;
                    const priceLabel = formatStorefrontMoney(price);
                    const targetQuery = query.trim() || product.name;
                    return (
                      <Link
                        href={buildShopSearchHref(targetQuery, selectedCategory.slug)}
                        key={`${product.slug}-${product.id}`}
                        onClick={handleResultNavigation}>
                        <CategoryNavigationRow
                          icon="right-arrow-2"
                          title={product.name}
                          eyebrow={getProductSearchContext(product) ?? t("search.result.product", { defaultMessage: "Product" })}
                          trailing={priceLabel}
                          showChevron={false}
                          minWidth="100%"
                        />
                      </Link>
                    );
                  })
                : null}

              {!isSearching && query.trim() ? (
                <Link href={buildShopSearchHref(query, selectedCategory.slug)} onClick={handleResultNavigation}>
                  <MenuItem>
                    <Span fontSize="14px" color="primary.main">
                      {results.length === 0 && matchedCategories.length === 0
                        ? t("search.noMatches.navigate", {
                            defaultMessage: "No exact matches. View results in the catalog.",
                          })
                        : t("search.viewAllResults", {
                            defaultMessage: "View all results",
                          })}
                    </Span>
                  </MenuItem>
                </Link>
              ) : null}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
