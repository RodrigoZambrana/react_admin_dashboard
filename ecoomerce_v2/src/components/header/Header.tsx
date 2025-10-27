"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconShoppingCart, IconUser } from "@tabler/icons-react";

import Login from "@sections/auth/Login";

import Box from "@component/Box";
import Modal from "@component/modal";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import MiniCart from "@component/mini-cart";
import Container from "@component/Container";
import { H4, H5, Span, Tiny } from "@component/Typography";
import { IconButton } from "@component/buttons";
import Sidenav from "@component/sidenav/Sidenav";
import Categories from "@component/categories/Categories";
import { SearchInputWithCategory } from "@component/search-box";
import useCart from "@hook/useCart";
import StyledHeader from "./styles";
import Logo from "./Logo";
import navbarNavigations from "@data/navbarNavigations";
import categoryNavigations from "@data/navigations";

const HOME_PATH = process.env.NEXT_PUBLIC_STOREFRONT_HOME_PATH || "/market-1";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

type HeaderProps = { isFixed?: boolean; className?: string };

type NavItem = {
  title: string;
  url?: string;
  extLink?: boolean;
  child?: NavItem[];
};

const renderNavTree = (
  items: NavItem[],
  depth: number,
  onNavigate: () => void
): JSX.Element[] =>
  items.map((item) => {
    const hasChildren = Array.isArray(item.child) && item.child.length > 0;
    const paddingLeft = depth === 0 ? 0 : depth * 16;

    const content = item.url ? (
      item.extLink ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={onNavigate}>
          <Span fontWeight={depth === 0 ? 600 : 400}>{item.title}</Span>
        </a>
      ) : (
        <Link href={item.url} onClick={onNavigate}>
          <Span fontWeight={depth === 0 ? 600 : 400}>{item.title}</Span>
        </Link>
      )
    ) : (
      <Span fontWeight={depth === 0 ? 600 : 400}>{item.title}</Span>
    );

    return (
      <Box key={`${item.title}-${depth}`} pl={`${paddingLeft}px`} mt="0.5rem">
        {content}
        {hasChildren && (
          <Box mt="0.35rem">{renderNavTree(item.child!, depth + 1, onNavigate)}</Box>
        )}
      </Box>
    );
  });

const renderCategorySections = (onNavigate: () => void): JSX.Element[] =>
  categoryNavigations.map((section) => {
    const menuData = (
      section as {
        menuData?: {
          categories?: Array<{
            title: string;
            href?: string;
            subCategories?: Array<{ title: string; href: string }>;
          }>;
          brands?: Array<{ title: string; href?: string }>;
        };
      }
    ).menuData ?? {};
    const categories = menuData.categories ?? [];
    const brands = menuData.brands ?? [];

    return (
      <Box key={section.title} mt="1.25rem">
        <FlexBox alignItems="center" mb="0.35rem" justifyContent="space-between">
          <H5 fontWeight={600}>{section.title}</H5>
          {section.href ? (
            <Link href={section.href} onClick={onNavigate}>
              <Span fontSize="12px" color="primary.main">
                Explore
              </Span>
            </Link>
          ) : null}
        </FlexBox>

        {categories.map((category) => (
          <Box key={category.title} pl="16px" mt="0.5rem">
            {category.href ? (
              <Link href={category.href} onClick={onNavigate}>
                <Span fontWeight={500}>{category.title}</Span>
              </Link>
            ) : (
              <Span fontWeight={500}>{category.title}</Span>
            )}

            {category.subCategories?.map((sub) => (
              <Box key={sub.title} pl="16px" mt="0.35rem">
                <Link href={sub.href} onClick={onNavigate}>
                  <Span color="text.muted" fontSize="14px">
                    {sub.title}
                  </Span>
                </Link>
              </Box>
            ))}
          </Box>
        ))}

        {brands.length > 0 && (
          <Box pl="16px" mt="0.75rem">
            <Span fontWeight={500}>Popular Brands</Span>
            <FlexBox flexWrap="wrap" gridGap="0.5rem" mt="0.35rem">
              {brands.map((brand: any) => (
                <Link key={brand.title} href={brand.href} onClick={onNavigate}>
                  <Span color="text.muted" fontSize="14px">
                    {brand.title}
                  </Span>
                </Link>
              ))}
            </FlexBox>
          </Box>
        )}
      </Box>
    );
  });

export default function Header({ isFixed, className }: HeaderProps) {
  const { state } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const homePath = useMemo(() => normalizePath(HOME_PATH), []);

  const handleOpenCart = useCallback(() => setCartOpen(true), []);
  const handleCloseCart = useCallback(() => setCartOpen(false), []);
  const handleOpenLogin = useCallback(() => setLoginOpen(true), []);
  const handleCloseLogin = useCallback(() => setLoginOpen(false), []);

  const handleCloseNav = useCallback(() => setNavOpen(false), []);
  const handleCloseCategory = useCallback(() => setCategoryOpen(false), []);

  const handleNavigateFromNav = useCallback(() => {
    setNavOpen(false);
    setCategoryOpen(false);
    setCartOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const openMenuListener = () => setNavOpen(true);
    const openCategoriesListener = () => setCategoryOpen(true);
    const openCartListener = () => setCartOpen(true);
    const openAccountListener = () => setLoginOpen(true);

    window.addEventListener("mobile-nav:open-menu", openMenuListener);
    window.addEventListener("mobile-nav:open-categories", openCategoriesListener);
    window.addEventListener("mobile-nav:open-cart", openCartListener);
    window.addEventListener("mobile-nav:open-account", openAccountListener);

    return () => {
      window.removeEventListener("mobile-nav:open-menu", openMenuListener);
      window.removeEventListener("mobile-nav:open-categories", openCategoriesListener);
      window.removeEventListener("mobile-nav:open-cart", openCartListener);
      window.removeEventListener("mobile-nav:open-account", openAccountListener);
    };
  }, []);


  const CartButton = ({ className }: { className?: string }) => (
    <Box className={className} position="relative">
      <IconButton
        bg="gray.200"
        p="12px"
        size="small"
        borderRadius={8}
        onClick={handleOpenCart}>
        <IconShoppingCart size={16} stroke={1.5} />
      </IconButton>

      {state.cart.length > 0 && (
        <FlexBox
          top={-5}
          right={-5}
          height={20}
          minWidth={20}
          bg="primary.main"
          borderRadius="50%"
          alignItems="center"
          position="absolute"
          justifyContent="center">
          <Tiny color="white" fontWeight="600" lineHeight={1}>
            {state.cart.length}
          </Tiny>
        </FlexBox>
      )}
    </Box>
  );

  const AccountButton = ({ className }: { className?: string }) => (
    <IconButton
      className={className}
      bg="gray.200"
      p="12px"
      size="small"
      borderRadius={8}
      onClick={handleOpenLogin}>
      <IconUser size={16} stroke={1.5} />
    </IconButton>
  );

  return (
    <StyledHeader className={className}>
      <Container className="container">
        <FlexBox className="mobile-actions" alignItems="center">
          <Sidenav
            open={navOpen}
            onClose={handleCloseNav}
            width={320}
            scroll
            position="left"
            handle={<span style={{ display: "none" }} />}>
            <Box p="1.25rem">
              <H4 mb="0.75rem" fontWeight={600}>
                Navegación
              </H4>
              {renderNavTree(navbarNavigations as NavItem[], 0, handleNavigateFromNav)}
            </Box>
          </Sidenav>

          <Sidenav
            open={categoryOpen}
            onClose={handleCloseCategory}
            width={320}
            scroll
            position="left"
            handle={<span style={{ display: "none" }} />}>
            <Box p="1.25rem">
              <H4 mb="0.75rem" fontWeight={600}>
                Categorías
              </H4>
              {renderCategorySections(handleNavigateFromNav)}
            </Box>
          </Sidenav>
        </FlexBox>

        <FlexBox className="logo" alignItems="center" mr="1rem">
          <Link href={homePath}>
            <Logo />
          </Link>

          {isFixed && (
            <div className="category-holder">
              <Categories
                handler={(handleOpen) => (
                  <FlexBox color="text.hint" alignItems="center" ml="1rem" onClick={handleOpen}>
                    <Icon>categories</Icon>
                    <Icon>arrow-down-filled</Icon>
                  </FlexBox>
                )}
              />
            </div>
          )}
        </FlexBox>

        <FlexBox className="search-wrapper" alignItems="center">
          <SearchInputWithCategory />

          <FlexBox className="mobile-search-icons" alignItems="center" gridGap="0.5rem">
            <AccountButton className="mobile-only" />
            <CartButton className="mobile-only" />
          </FlexBox>
        </FlexBox>

        <FlexBox className="header-right desktop-only" alignItems="center" gridGap="1rem">
          <AccountButton />
          <Sidenav
            open={cartOpen}
            width={380}
            position="right"
            scroll
            onClose={handleCloseCart}
            handle={<CartButton />}>
            <MiniCart />
          </Sidenav>
        </FlexBox>
      </Container>

      <Modal open={loginOpen} onClose={handleCloseLogin}>
        <Box width="min(90vw, 520px)">
          <Login />
        </Box>
      </Modal>

    </StyledHeader>
  );
}
