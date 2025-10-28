"use client";

import Link from "next/link";
import type { JSX, MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormikHelpers } from "formik";
import { IconChevronRight, IconShoppingCart, IconUser } from "@tabler/icons-react";

import Login, { type LoginFormValues } from "@sections/auth/Login";

import Box from "@component/Box";
import Modal from "@component/modal";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import MiniCart from "@component/mini-cart";
import Container from "@component/Container";
import { H4, Span, Tiny } from "@component/Typography";
import { Button, IconButton } from "@component/buttons";
import Sidenav from "@component/sidenav/Sidenav";
import Categories from "@component/categories/Categories";
import { SearchInputWithCategory } from "@component/search-box";
import useCart from "@hook/useCart";
import { useSession } from "@/state/session-context";
import { looksLikePhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone";
import type { CategorySummary } from "@/types/storefront";
import { useStorefrontNavigation, type StorefrontNavigationNode } from "@/hooks/useStorefrontNavigation";
import DashboardNavigation from "@component/layout/DashboardNavigation";
import StyledHeader from "./styles";
import Logo from "./Logo";
import CustomerNotifications from "./CustomerNotifications";

type HeaderProps = { isFixed?: boolean; className?: string };

type NavItem = StorefrontNavigationNode;

const renderNavTree = (
  items: NavItem[],
  depth: number,
  onNavigate: () => void
): JSX.Element[] =>
  items.map((item, index) => {
    const hasChildren = Array.isArray(item.child) && item.child.length > 0;
    const paddingLeft = depth === 0 ? 0 : depth * 16;
    const itemKey = `${item.title}-${item.url ?? index}-${depth}`;

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
      <Box key={itemKey} pl={`${paddingLeft}px`} mt="0.5rem">
        {content}
        {hasChildren && (
          <Box mt="0.35rem">{renderNavTree(item.child!, depth + 1, onNavigate)}</Box>
        )}
      </Box>
    );
  });

const renderCategoryDrawer = (
  categories: CategorySummary[],
  icons: string[],
  onNavigate: () => void
): JSX.Element[] =>
  categories.map((category, index) => {
    const iconName = icons[index % icons.length] ?? "category";
    const childCategories = Array.isArray(category.children) ? category.children : [];

    const categoryLink = category.slug
      ? `/product/search/${encodeURIComponent(category.slug)}`
      : undefined;

    return (
      <Box key={category.slug ?? category.id} mt="0.75rem">
        <FlexBox alignItems="center" justifyContent="space-between" gridGap="0.75rem">
          <FlexBox alignItems="center" gridGap="0.5rem" flex="1 1 auto">
            <Icon variant="small">{iconName}</Icon>
            {categoryLink ? (
              <Link href={categoryLink} onClick={onNavigate}>
                <Span fontWeight={600}>{category.name}</Span>
              </Link>
            ) : (
              <Span fontWeight={600}>{category.name}</Span>
            )}
          </FlexBox>

          <IconChevronRight size={16} stroke={1.5} />
        </FlexBox>

        {childCategories.length > 0 && (
          <Box
            mt="0.4rem"
            pl="1.75rem"
            display="flex"
            flexDirection="column"
            gridGap="0.35rem">
            {childCategories.map((child) => {
              const childKey = child.slug ?? `${category.slug}-${child.name}`;
              const content = (
                <FlexBox
                  alignItems="center"
                  justifyContent="space-between"
                  gridGap="0.5rem"
                  color="text.muted">
                  <Span fontSize="14px">{child.name}</Span>
                  <IconChevronRight size={14} stroke={1.5} />
                </FlexBox>
              );

              if (child.slug) {
                return (
                  <Link
                    key={child.slug}
                    href={`/product/search/${encodeURIComponent(child.slug)}`}
                    onClick={onNavigate}>
                    {content}
                  </Link>
                );
              }

              return <Box key={childKey}>{content}</Box>;
            })}
          </Box>
        )}
      </Box>
    );
  });

export default function Header({ isFixed, className }: HeaderProps) {
  const { state, itemCount } = useCart();
  const router = useRouter();
  const { isAuthenticated, logout, login, loginWithGoogle, error, clearError } = useSession();
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const { homePath, navItems, categoriesForMenu, categoryIcons } = useStorefrontNavigation();
  const googleButtonEnabled = process.env.NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED !== "false";

  const handleOpenCart = useCallback(() => setCartOpen(true), []);
  const handleCloseCart = useCallback(() => setCartOpen(false), []);
  const handleOpenLogin = useCallback(() => {
    clearError();
    setLoginOpen(true);
  }, [clearError]);
  const handleCloseLogin = useCallback(() => {
    setLoginOpen(false);
    clearError();
  }, [clearError]);
  const handleOpenAccountMenu = useCallback(() => setAccountOpen(true), []);
  const handleCloseAccountMenu = useCallback(() => setAccountOpen(false), []);

  const handleCloseNav = useCallback(() => setNavOpen(false), []);
  const handleCloseCategory = useCallback(() => setCategoryOpen(false), []);

  const handleNavigateFromNav = useCallback(() => {
    setNavOpen(false);
    setCategoryOpen(false);
    setCartOpen(false);
    setAccountOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setAccountOpen(false);
    router.push(homePath);
  }, [homePath, logout, router]);

  const handleLoginSubmit = useCallback(
    async (values: LoginFormValues, helpers: FormikHelpers<LoginFormValues>) => {
      clearError();
      const trimmedIdentifier = values.identifier.trim();
      let payloadIdentifier = trimmedIdentifier;

      if (looksLikePhoneNumber(trimmedIdentifier)) {
        const normalized = normalizePhoneNumber(trimmedIdentifier);
        if (!normalized) {
          helpers.setFieldError("identifier", "Enter a valid phone number");
          helpers.setSubmitting(false);
          return;
        }
        payloadIdentifier = normalized;
      }

      setLoginSubmitting(true);

      try {
        await login(payloadIdentifier, values.password);
        setLoginOpen(false);
      } catch (err) {
        // error handled by session context
      } finally {
        setLoginSubmitting(false);
        helpers.setSubmitting(false);
      }
    },
    [clearError, login]
  );

  const handleAccountAction = useCallback(() => {
    if (isAuthenticated) {
      handleCloseLogin();
      handleOpenAccountMenu();
    } else {
      handleCloseAccountMenu();
      handleOpenLogin();
    }
  }, [
    handleCloseAccountMenu,
    handleCloseLogin,
    handleOpenAccountMenu,
    handleOpenLogin,
    isAuthenticated
  ]);

  const handleGoogleSignIn = useCallback(async () => {
    if (googleSigningIn) {
      return;
    }
    setGoogleSigningIn(true);
    try {
      const result = await loginWithGoogle();
      setLoginOpen(false);
      if (result.returnPath) {
        router.push(result.returnPath);
      }
    } catch (error) {
      // handled by session context
    } finally {
      setGoogleSigningIn(false);
    }
  }, [googleSigningIn, loginWithGoogle, router, setLoginOpen]);

  const handleAccountNavClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("a")) {
        handleCloseAccountMenu();
      }
    },
    [handleCloseAccountMenu]
  );

  useEffect(() => {
    if (isAuthenticated) {
      setLoginOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccountOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!loginOpen) {
      setGoogleSigningIn(false);
    }
  }, [loginOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const openMenuListener = () => setNavOpen(true);
    const openCategoriesListener = () => setCategoryOpen(true);
    const openCartListener = () => setCartOpen(true);
    const openAccountListener = () => handleAccountAction();
    const openLoginListener = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      handleOpenLogin();
    };

    window.addEventListener("mobile-nav:open-menu", openMenuListener);
    window.addEventListener("mobile-nav:open-categories", openCategoriesListener);
    window.addEventListener("mobile-nav:open-cart", openCartListener);
    window.addEventListener("mobile-nav:open-account", openAccountListener);
    window.addEventListener("storefront:auth:login", openLoginListener);

    return () => {
      window.removeEventListener("mobile-nav:open-menu", openMenuListener);
      window.removeEventListener("mobile-nav:open-categories", openCategoriesListener);
      window.removeEventListener("mobile-nav:open-cart", openCartListener);
      window.removeEventListener("mobile-nav:open-account", openAccountListener);
      window.removeEventListener("storefront:auth:login", openLoginListener);
    };
  }, [handleAccountAction, handleOpenLogin]);


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

      {itemCount > 0 && (
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
            {itemCount}
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
      onClick={handleAccountAction}>
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
              {renderNavTree(navItems as NavItem[], 0, handleNavigateFromNav)}
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
              <Box mt="0.75rem" display="flex" flexDirection="column" gridGap="0.25rem">
                {renderCategoryDrawer(categoriesForMenu, categoryIcons, handleNavigateFromNav)}
              </Box>
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
                categories={categoriesForMenu}
                icons={categoryIcons}
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
        </FlexBox>

        <FlexBox className="header-right desktop-only" alignItems="center" gridGap="1rem">
          <CustomerNotifications />
          <Sidenav
            open={accountOpen}
            width={320}
            position="left"
            scroll
            onClose={handleCloseAccountMenu}
            handle={<AccountButton />}>
            <Box p="1.25rem" height="100%" display="flex" flexDirection="column" onClickCapture={handleAccountNavClick}>
              <H4 mb="0.75rem" fontWeight={600}>
                My Account
              </H4>
              <Box flex="1 1 0" overflow="auto" pr="0.25rem">
                <DashboardNavigation />
              </Box>
              <Button variant="outlined" color="primary" mt="1.5rem" onClick={() => { void handleLogout(); }}>
                Log out
              </Button>
            </Box>
          </Sidenav>
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
          <Login
            onSubmit={handleLoginSubmit}
            submitting={loginSubmitting}
            errorMessage={error}
            registerHref="/account/register"
            forgotPasswordHref="/account/forgot-password"
            onGoogleSignIn={handleGoogleSignIn}
            googleSubmitting={googleSigningIn}
            googleEnabled={googleButtonEnabled}
          />
        </Box>
      </Modal>

    </StyledHeader>
  );
}
