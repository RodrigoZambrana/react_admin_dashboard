"use client";

import { useCallback, useState } from "react";
import { IconChevronDown, IconMail, IconPhone } from "@tabler/icons-react";

import Menu from "../menu";
import Image from "../Image";
import NavLink from "../nav-link";
import MenuItem from "../MenuItem";
import Container from "../Container";
import { Small } from "../Typography";
import { StyledTopbar } from "./styles";
import { LANGUAGES, CURRENCIES } from "./data";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useI18n, useTranslation } from "@/state/i18n-context";

export default function Topbar() {
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const storefrontConfig = useStorefrontConfig();
  const { locale, setLocale } = useI18n();
  const t = useTranslation();
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

  const handleCurrencyClick = useCallback((curr: typeof currency) => () => setCurrency(curr), []);

  const handleLanguageClick = useCallback(
    (langLocale: (typeof LANGUAGES)[number]["locale"]) => () => setLocale(langLocale),
    [setLocale]
  );

  return (
    <StyledTopbar>
      <Container className="container">
        <div className="topbar-left">
          <div className="logo">
            <Image src={logoSrc} alt={brandName} height="36px" />
          </div>

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

          {/* <Menu
            direction="right"
            handler={
              <FlexBox className="dropdown-handler" alignItems="center" height="40px">
                <Image src={currency.imgUrl} alt={currency.title} />
                <Small fontWeight="600">{currency.title}</Small>
                <IconChevronDown size={16} stroke={1.5} />
              </FlexBox>
            }>
            {CURRENCIES.map((item) => (
              <MenuItem key={item.id} onClick={handleCurrencyClick(item)}>
                <Image src={item.imgUrl} borderRadius="2px" mr="0.5rem" alt={item.title} />
                <Small fontWeight="600">{item.title}</Small>
              </MenuItem>
            ))}
          </Menu> */}
        </div>
      </Container>
    </StyledTopbar>
  );
}
