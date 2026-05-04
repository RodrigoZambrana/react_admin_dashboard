"use client";

import { IconChevronDown, IconMail, IconPhone } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";

import Menu from "../menu";
import Image from "../Image";
import NavLink from "../nav-link";
import MenuItem from "../MenuItem";
import Container from "../Container";
import { Small } from "../Typography";
import { StyledTopbar } from "./styles";
import { LANGUAGES } from "./data";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useI18n, useTranslation } from "@/state/i18n-context";
import { useCurrency } from "@/state/currency-context";
import Select from "@component/Select";
import { formatCurrencyOptionLabel, getCurrencySymbolSafe, normalizeCurrencyCode } from "@/lib/currency/utils";
import type { SingleValue } from "react-select";

type CurrencyOption = {
  value: string;
  label: string;
  code: string;
};

export default function Topbar() {
  const storefrontConfig = useStorefrontConfig();
  const { locale, setLocale, availableLocales } = useI18n();
  const t = useTranslation();
  const { currency, availableCurrencies, setCurrency } = useCurrency();
  const companyProfile = storefrontConfig.companyProfile;
  const helpLinks = storefrontConfig.navigation?.helpLinks ?? [];
  const storefrontFeatures = storefrontConfig.features;

  const logoSrc = companyProfile?.logo ?? null;
  const brandName =
    companyProfile?.tradeName ??
    companyProfile?.legalName ??
    (typeof storefrontConfig.seo?.siteName === "string"
      ? storefrontConfig.seo.siteName
      : "Storefront");
  const phone = companyProfile?.phone ?? null;
  const email = companyProfile?.email ?? null;

  const languageOptions = useMemo(
    () => LANGUAGES.filter((item) => availableLocales.includes(item.locale)),
    [availableLocales]
  );
  const activeLanguage = languageOptions.find((item) => item.locale === locale) ?? languageOptions[0] ?? LANGUAGES[0];
  const showLanguageSelector =
    storefrontFeatures?.languageSelector !== false && languageOptions.length > 1;

  const handleLanguageClick = useCallback(
    (langLocale: (typeof LANGUAGES)[number]["locale"]) => () => setLocale(langLocale),
    [setLocale]
  );

  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const normalized = availableCurrencies
      .map((code) => normalizeCurrencyCode(code))
      .filter((code): code is string => Boolean(code));
    const unique = Array.from(new Set(normalized));
    return unique.map((code) => ({
      value: code,
      label: getCurrencySymbolSafe(code) ?? code,
      code
    }));
  }, [availableCurrencies]);

  const selectedCurrency = useMemo(
    () => currencyOptions.find((option) => option.value === currency) ?? null,
    [currency, currencyOptions]
  );

  const renderCurrencyOption = useCallback(
    (option: CurrencyOption, meta: { context: "menu" | "value" }) =>
      meta.context === "value"
        ? option.label
        : `${option.label} · ${formatCurrencyOptionLabel(option.value)}`,
    []
  );

  const handleCurrencySelect = useCallback(
    (option: SingleValue<CurrencyOption>) => {
      if (!option) return;
      setCurrency(option.value);
    },
    [setCurrency]
  );

  return (
    <StyledTopbar>
      <Container className="container">
        <div className="topbar-left">
          <NavLink className="logo" href="/" aria-label={brandName}>
            {logoSrc ? (
              <Image src={logoSrc} alt={brandName} height="36px" />
            ) : (
              <Small fontWeight="700" style={{ letterSpacing: "0.02em" }}>
                {brandName}
              </Small>
            )}
          </NavLink>

          {phone && (
            <div className="phone">
              <IconPhone size={16} stroke={1.5} />
              <span>{phone}</span>
            </div>
          )}

          {email && (
            <div className="email">
              <IconMail size={16} stroke={1.5} />
              <span>{email}</span>
            </div>
          )}
        </div>

        <div className="topbar-right">
          <NavLink className="link" href={helpLinks[0]?.href ?? "/contacto"}>
            {helpLinks[0]?.label ? t(helpLinks[0].label) : t("FAQ")}
          </NavLink>

          <NavLink className="link" href={helpLinks[1]?.href ?? "/contacto"}>
            {helpLinks[1]?.label ? t(helpLinks[1].label) : t("Need Help?")}
          </NavLink>

          {showLanguageSelector ? (
            <Menu
              direction="right"
              handler={(handleOpen) => (
                <div className="dropdown-handler" onClick={handleOpen}>
                  <Image src={activeLanguage.imgUrl} alt={activeLanguage.title} />
                  <Small fontWeight="600">{activeLanguage.shortLabel}</Small>
                  <IconChevronDown size={16} stroke={1.5} />
                </div>
              )}>
              {languageOptions.map((item) => (
                <MenuItem key={item.id} onClick={handleLanguageClick(item.locale)}>
                  <Image src={item.imgUrl} borderRadius="2px" mr="0.5rem" alt={item.title} />
                  <Small fontWeight="600">{item.title}</Small>
                </MenuItem>
              ))}
            </Menu>
          ) : null}

          {currencyOptions.length > 0 ? (
            <div className="dropdown-handler currency-selector">
              <Select
                options={currencyOptions}
                value={selectedCurrency}
                onChange={handleCurrencySelect}
                isSearchable={false}
                isDisabled={currencyOptions.length <= 1}
                placeholder={t("Select currency")}
                instanceId="topbar-currency-selector"
                formatOptionLabel={(option: CurrencyOption, meta: { context: "menu" | "value" }) =>
                  renderCurrencyOption(option, meta)}
              />
            </div>
          ) : null}
        </div>
      </Container>
    </StyledTopbar>
  );
}
