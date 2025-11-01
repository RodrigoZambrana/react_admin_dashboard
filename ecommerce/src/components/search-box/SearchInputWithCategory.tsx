"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import debounce from "lodash/debounce";

import Box from "@component/Box";
import Menu from "@component/menu/Menu";
import Card from "@component/Card";
import FlexBox from "@component/FlexBox";
import MenuItem from "@component/MenuItem";
import { Span } from "@component/Typography";
import TextField from "@component/text-field";
import StyledSearchBox from "./styled";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { CategorySummary, ProductSummary } from "@/types/storefront";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { useTranslation } from "@/state/i18n-context";

const dropdownVariants = {
  hidden: {
    y: -10,
    opacity: 0,
    scale: 0.95
  },
  visible: {
    y: 0,
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: {
    y: -10,
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 }
  }
};

type CategoryOption = {
  label: string;
  slug?: string;
};

const DEFAULT_CATEGORY: CategoryOption = { label: "All Categories" };

export default function SearchInputWithCategory() {
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([DEFAULT_CATEGORY]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption>(DEFAULT_CATEGORY);
  const { formatMoney: formatStorefrontMoney } = useMoneyFormatter();
  const t = useTranslation();

  const latestRequestRef = useRef(0);

  const buildCategoryOptions = useCallback((categories: CategorySummary[]): CategoryOption[] => {
    return categories.map((category) => ({
      label: category.name,
      slug: category.slug
    }));
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await StorefrontApi.listCategories();
      const options = buildCategoryOptions(data);
      setCategoryOptions((prev) => {
        if (options.length === 0) {
          return prev.length ? prev : [DEFAULT_CATEGORY];
        }
        return [DEFAULT_CATEGORY, ...options];
      });
    } catch (error) {
      if (!isApiError(error)) {
        console.warn("[search] Failed to load categories from API, falling back to defaults.", error);
      }
    }
  }, [buildCategoryOptions]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
            pageSize: 6
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
    []
  );

  useEffect(
    () => () => {
      debouncedSearch.cancel();
    },
    [debouncedSearch]
  );

  const handleCategoryChange = useCallback(
    (option: CategoryOption) => () => {
      setSelectedCategory(option);
      if (query.trim()) {
        debouncedSearch(query, option.slug);
      }
    },
    [debouncedSearch, query]
  );

  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setQuery(value);

      if (!value.trim()) {
        debouncedSearch.cancel();
        setResults([]);
        setIsSearching(false);
        return;
      }

      debouncedSearch(value, selectedCategory.slug);
    },
    [debouncedSearch, selectedCategory.slug]
  );

  const handleDocumentClick = useCallback(() => {
    setResults([]);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    window.addEventListener("click", handleDocumentClick);
    return () => window.removeEventListener("click", handleDocumentClick);
  }, [handleDocumentClick]);

  const handleSearchBoxClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const hasResults = results.length > 0 || isSearching;

  return (
    <Box
      zIndex={99}
      position="relative"
      flex="1 1 0"
      maxWidth="670px"
      mx="auto"
      onClick={handleSearchBoxClick}>
      <StyledSearchBox>
        <IconSearch size={18} stroke={1.5} className="search-icon" />

        <TextField
          fullWidth
          onChange={handleSearch}
          className="search-field"
          placeholder="Search and hit enter..."
        />

        <Menu
          direction="right"
          className="category-dropdown"
          handler={(openMenu) => (
            <FlexBox className="dropdown-handler" alignItems="center" onClick={openMenu}>
              <span>{t(selectedCategory.label)}</span>
              <IconChevronDown size={18} stroke={1.5} />
            </FlexBox>
          )}>
          {categoryOptions.map((option) => (
            <MenuItem key={option.slug ?? option.label} onClick={handleCategoryChange(option)}>
              <Span
                fontSize="14px"
                fontWeight={option.slug === selectedCategory.slug ? 600 : 400}
                color={option.slug === selectedCategory.slug ? "primary.main" : "inherit"}>
                {t(option.label)}
              </Span>
            </MenuItem>
          ))}
        </Menu>
      </StyledSearchBox>

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
              position: "absolute"
            }}>
            <Card py="0.5rem" mt="0.25rem" boxShadow="large" borderRadius=".5rem">
              {isSearching ? (
                <MenuItem>
                  <Span fontSize="14px">{t("Searching…")}</Span>
                </MenuItem>
              ) : (
                results.map((product) => {
                  const price = product.salePrice ?? product.price;
                  const priceLabel = formatStorefrontMoney(price);
                  return (
                    <Link href={`/product/${product.slug}`} key={product.slug}>
                      <MenuItem>
                        <FlexBox
                          alignItems="center"
                          justifyContent="space-between"
                          width="100%"
                          gridGap="0.75rem">
                          <Span fontSize="14px">{product.name}</Span>
                          <Span fontSize="12px" color="text.muted">
                            {priceLabel}
                          </Span>
                        </FlexBox>
                      </MenuItem>
                    </Link>
                  );
                })
              )}
              {!isSearching && results.length === 0 && query.trim() ? (
                <MenuItem>
                  <Span fontSize="14px">{t("No products found.")}</Span>
                </MenuItem>
              ) : null}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
