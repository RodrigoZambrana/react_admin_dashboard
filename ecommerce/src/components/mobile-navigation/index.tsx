'use client';

import { useMemo } from "react";
import styled from "styled-components";

import Chip from "@component/Chip";
import Icon from "@component/icon/Icon";
import NavLink from "@component/nav-link";
import useCart from "@hook/useCart";
import useWindowSize from "@hook/useWindowSize";
import { useTranslation } from "@/state/i18n-context";
import { layoutConstant } from "@utils/constants";

// STYLED COMPONENT
const Wrapper = styled.div<{ $itemCount: number }>`
  --nav-gap: clamp(0.35rem, 1.8vw, 1.25rem);
  left: 0;
  right: 0;
  bottom: 0;
  display: none;
  position: fixed;
  align-items: center;
  padding: 0 calc(var(--nav-gap) / 2);
  height: ${layoutConstant.mobileNavHeight};
  background: ${({ theme }) => theme.colors.body.paper};
  box-shadow: 0px 1px 4px 3px rgba(0, 0, 0, 0.1);
  z-index: 999;

  .link {
    width: 100%;
    display: flex;
    font-size: 13px;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    position: relative;
    padding: 0.35rem 0;
    gap: 6px;

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .link-button {
    border: none;
    background: transparent;
    color: inherit;
    padding: 0;
  }

  @media (max-width: 900px) {
    display: grid;
    width: 100vw;
    grid-template-columns: repeat(${({ $itemCount }) => $itemCount}, minmax(0, 1fr));
    column-gap: var(--nav-gap);
  }
`;

const HOME_PATH = process.env.NEXT_PUBLIC_STOREFRONT_HOME_PATH || "/";

type MobileNavItem = {
  title: string;
  icon: string;
  href?: string;
  action?: string;
  showCartCount?: boolean;
};

export default function MobileNavigationBar() {
  const { state, itemCount } = useCart();
  const width = useWindowSize();
  const t = useTranslation();

  const items = useMemo<MobileNavItem[]>(
    () => [
      {
        title: t("mobileNav.menu", { defaultMessage: "Menu" }),
        icon: "menu",
        action: "mobile-nav:open-menu"
      },
      {
        title: t("mobileNav.home", { defaultMessage: "Home" }),
        icon: "home",
        href: HOME_PATH.startsWith("/") ? HOME_PATH : `/${HOME_PATH}`
      },
      {
        title: t("mobileNav.shop", { defaultMessage: "Shop" }),
        icon: "bag",
        href: "/shop"
      },
      {
        title: t("mobileNav.categories", { defaultMessage: "Categories" }),
        icon: "category",
        action: "mobile-nav:open-categories"
      },
      {
        title: t("mobileNav.cart", { defaultMessage: "Cart" }),
        icon: "shopping-cart",
        action: "mobile-nav:open-cart",
        showCartCount: true
      },
      {
        title: t("mobileNav.account", { defaultMessage: "Account" }),
        icon: "user-2",
        action: "mobile-nav:open-account"
      }
    ],
    [t]
  );

  const handleAction = (action: string) => () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(action));
    }
  };

  if ((width ?? 0) <= 900) {
    return (
      <Wrapper $itemCount={items.length}>
        {items.map((item) => {
          const content = (
            <>
              <Icon className="icon" variant="small">
                {item.icon}
              </Icon>

              {item.title}

              {item.showCartCount && !!itemCount && (
                <Chip
                  top="4px"
                  px="0.25rem"
                  fontWeight="600"
                  bg="primary.main"
                  position="absolute"
                  color="primary.text"
                  left="calc(50% + 8px)">
                  {itemCount}
                </Chip>
              )}
            </>
          );

          if (item.action) {
            return (
              <button
                type="button"
                key={item.title}
                className="link link-button"
                onClick={handleAction(item.action)}>
                {content}
              </button>
            );
          }

          return (
            <NavLink className="link" href={item.href!} key={item.title}>
              {content}
            </NavLink>
          );
        })}
      </Wrapper>
    );
  }

  return null;
}
