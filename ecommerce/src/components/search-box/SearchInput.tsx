"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import debounce from "lodash/debounce";
import { IconSearch } from "@tabler/icons-react";
import { usePathname } from "next/navigation";

import Box from "@component/Box";
import Card from "@component/Card";
import Icon from "@component/icon/Icon";
import MenuItem from "@component/MenuItem";
import { Button } from "@component/buttons";
import { Span } from "@component/Typography";
import TextField from "@component/text-field";
import SearchBoxStyle from "./styled";
import { useTranslation } from "@/state/i18n-context";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";
import { normalizeSearchValue } from "@/lib/storefront/search-utils";

export default function SearchInput() {
  const [resultList, setResultList] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const t = useTranslation();
  const pathname = usePathname();
  const pageType = resolvePageType(pathname);
  const lastTrackedQueryRef = useRef<string | null>(null);
  const searchRef = useComponentTracking({
    pageType,
    componentType: "search_input",
    componentId: "search_input_basic",
    metadata: { variant: "basic" }
  });

  const emitSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      if (lastTrackedQueryRef.current === trimmed) {
        return;
      }

      lastTrackedQueryRef.current = trimmed;

      void trackEvent({
        event_name: "search",
        event_category: "navigation",
        tenant_id: env.clientSlug,
        page_type: pageType,
        component_type: "search_input",
        component_id: "search_input_basic",
        cta_id: "search.submit",
        cta_name: "search",
        cta_type: "primary",
        cta_context: "navigation",
        cta_location: "search_bar",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          query: trimmed,
          query_normalized: normalizeSearchValue(trimmed),
          search_stage: "intent",
          search_source: "basic_search",
        },
        data: {
          query: trimmed,
          query_normalized: normalizeSearchValue(trimmed),
          search_stage: "intent",
          search_source: "basic_search",
        },
      });
    },
    [pageType]
  );

  const search = useMemo(
    () =>
      debounce((value: string) => {
        if (!value) {
          setResultList([]);
          return;
        }

        setResultList(dummySearchResult);
        emitSearch(value);
      }, 200),
    [emitSearch]
  );

  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setQuery(value);
      search(value);
    },
    [search]
  );

  const handleSearchSubmit = useCallback(() => {
    emitSearch(query);
  }, [emitSearch, query]);

  const handleDocumentClick = useCallback(() => setResultList([]), []);

  useEffect(() => {
    window.addEventListener("click", handleDocumentClick);
    return () => window.removeEventListener("click", handleDocumentClick);
  }, [handleDocumentClick]);

  useEffect(() => {
    return () => search.cancel();
  }, [search]);

  return (
    <Box position="relative" flex="1 1 0" maxWidth="670px" mx="auto" ref={searchRef as never}>
      <SearchBoxStyle>
        <IconSearch className="search-icon" size={18} />

        <TextField
          fullWidth
          value={query}
          onChange={handleSearch}
          className="search-field"
          placeholder={t("Search and hit enter...")}
        />

        <Button
          className="search-button"
          variant="contained"
          color="primary"
          onClick={handleSearchSubmit}
          type="button">
          {t("Search")}
        </Button>

        <Box className="menu-button" ml="14px" cursor="pointer">
          <Icon color="primary">menu</Icon>
        </Box>
      </SearchBoxStyle>

      {!!resultList.length && (
        <Card position="absolute" top="100%" py="0.5rem" width="100%" boxShadow="large" zIndex={99}>
          {resultList.map((item) => (
            <Link href={`/product/search/${item}`} key={item}>
              <MenuItem key={item}>
                <Span fontSize="14px">{item}</Span>
              </MenuItem>
            </Link>
          ))}
        </Card>
      )}
    </Box>
  );
}

const dummySearchResult = ["Macbook Air 13", "Ksus K555LA", "Acer Aspire X453", "iPad Mini 3"];
