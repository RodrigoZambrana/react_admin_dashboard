"use client";

import Link from "next/link";
import type { JSX, MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormikHelpers } from "formik";
import { useTheme } from "styled-components";
import { IconCategoryFilled, IconChevronDown, IconShoppingCart, IconUser } from "@tabler/icons-react";

import Login, { type LoginFormValues } from "@sections/auth/Login";

import Box from "@component/Box";
import Modal from "@component/modal";
import FlexBox from "@component/FlexBox";
import MiniCart from "@component/mini-cart";
import Container from "@component/Container";
import Typography, { H4, Span, Tiny } from "@component/Typography";
import { Button, IconButton } from "@component/buttons";
import Sidenav from "@component/sidenav/Sidenav";
import Categories from "@component/categories/Categories";
import CategoryDropdown from "@component/categories/CategoryDropdown";
import { SearchInputWithCategory } from "@component/search-box";
import useCart from "@hook/useCart";
import { useSession } from "@/state/session-context";
import { useTranslation } from "@/state/i18n-context";
import { looksLikePhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone";
import type { CategorySummary } from "@/types/storefront";
import { useStorefrontNavigation, type StorefrontNavigationNode } from "@/hooks/useStorefrontNavigation";
import DashboardNavigation from "@component/layout/DashboardNavigation";
import StyledHeader from "./styles";
import Logo from "./Logo";
import CustomerNotifications from "./CustomerNotifications";
import MobileNavigationMenu from "./MobileNavigationMenu";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";

type HeaderProps = { isFixed?: boolean; className?: string };

export default function Header({ isFixed, className }: HeaderProps) {
  const theme = useTheme();
  const { state, itemCount } = useCart();
  const router = useRouter();
  const { isAuthenticated, logout, login, loginWithGoogle, error, clearError } = useSession();
  const t = useTranslation();
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const { homePath, navItems, categoriesForMenu, categoryIcons } = useStorefrontNavigation();
  const storefrontConfig = useStorefrontConfig();
  const googleIntegration = storefrontConfig?.integrations?.google;
  const googleButtonEnabled =
    googleIntegration?.enabled ?? process.env.NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED !== "false";

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
              <MobileNavigationMenu
                items={navItems as StorefrontNavigationNode[]}
                onNavigate={handleNavigateFromNav}
              />
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
                {t("categories.page.title", { defaultMessage: "Categories" })}
              </H4>
              <Box mt="0.75rem">
                <CategoryDropdown
                  open
                  position="relative"
                  categories={categoriesForMenu}
                  icons={categoryIcons}
                  interactionMode="accordion"
                  onNavigate={handleNavigateFromNav}
                />
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
                  <Button
                    width="278px"
                    variant="text"
                    height="40px"
                    bg="body.default"
                    onClick={handleOpen}>
                    <IconCategoryFilled
                      key="category-icon"
                      stroke={1.5}
                      size={18}
                      color={theme.colors.primary.main}
                    />

                    <Typography
                      key="category-label"
                      ml="10px"
                      flex="1 1 0"
                      fontWeight="600"
                      textAlign="left"
                      color="text.muted">
                      {t("Categories", { defaultMessage: "Categories" })}
                    </Typography>

                    <IconChevronDown
                      key="category-chevron"
                      className="dropdown-icon"
                      size={18}
                      stroke={1.5}
                    />
                  </Button>
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
                {t("My Account")}
              </H4>
              <Box flex="1 1 0" overflow="auto" pr="0.25rem">
                <DashboardNavigation />
              </Box>
              <Button variant="outlined" color="primary" mt="1.5rem" onClick={() => { void handleLogout(); }}>
                {t("Log out")}
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
