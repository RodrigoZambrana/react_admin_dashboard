"use client";

import { useCallback, useMemo } from "react";
import { IconChevronDown, IconMail, IconPhone } from "@tabler/icons-react";

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
import { formatCurrencyOptionLabel } from "@/lib/currency/utils";
import type { SingleValue } from "react-select";

export default function Topbar() {
  const storefrontConfig = useStorefrontConfig();
  const { locale, setLocale } = useI18n();
  const t = useTranslation();
  const { currency, availableCurrencies, setCurrency } = useCurrency();
  const companyProfile = storefrontConfig.companyProfile;

  const logoSrc = companyProfile?.logo ?? "/assets/images/logo.svg";
  const brandName =
    companyProfile?.tradeName ??
    companyProfile?.legalName ??
    (typeof storefrontConfig.seo?.siteName === "string"
      ? storefrontConfig.seo.siteName
      : "Storefront");
  const phone = companyProfile?.phone ?? "+88012 3456 7894";
  const email = companyProfile?.email ?? "support@ui-lib.com";

  const activeLanguage = LANGUAGES.find((item) => item.locale === locale) ?? LANGUAGES[0];

  const handleLanguageClick = useCallback(
    (langLocale: (typeof LANGUAGES)[number]["locale"]) => () => setLocale(langLocale),
    [setLocale]
  );

  const currencyOptions = useMemo(
    () =>
      availableCurrencies.map((code) => ({
        value: code,
        label: formatCurrencyOptionLabel(code)
      })),
    [availableCurrencies]
  );

  const selectedCurrency = useMemo(
    () => currencyOptions.find((option) => option.value === currency) ?? null,
    [currency, currencyOptions]
  );

  const handleCurrencySelect = useCallback(
    (option: SingleValue<{ value: string; label: string }>) => {
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
            <Image src={logoSrc} alt={brandName} height="36px" />
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
          <NavLink className="link" href="/">
            {t('Theme FAQ"s')}
          </NavLink>

          <NavLink className="link" href="/">
            {t("Need Help?")}
          </NavLink>

          <Menu
            direction="right"
            handler={(handleOpen) => (
              <div className="dropdown-handler" onClick={handleOpen}>
                <Image src={activeLanguage.imgUrl} alt={activeLanguage.title} />
                <Small fontWeight="600">{activeLanguage.shortLabel}</Small>
                <IconChevronDown size={16} stroke={1.5} />
              </div>
            )}>
            {LANGUAGES.map((item) => (
              <MenuItem key={item.id} onClick={handleLanguageClick(item.locale)}>
                <Image src={item.imgUrl} borderRadius="2px" mr="0.5rem" alt={item.title} />
                <Small fontWeight="600">{item.title}</Small>
              </MenuItem>
            ))}
          </Menu>

          {currencyOptions.length > 0 ? (
            <div className="dropdown-handler" style={{ minWidth: "120px" }}>
              <Select
                options={currencyOptions}
                value={selectedCurrency}
                onChange={handleCurrencySelect}
                isSearchable={false}
                isDisabled={currencyOptions.length <= 1}
                placeholder="Select currency"
                instanceId="topbar-currency-selector"
              />
            </div>
          ) : null}
        </div>
      </Container>
    </StyledTopbar>
  );
}
