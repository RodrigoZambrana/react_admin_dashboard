import { notFound, redirect } from "next/navigation";

type DemoRouteBehavior =
  | "public"
  | "notFound"
  | "redirect-home"
  | "redirect-login"
  | "redirect-register"
  | "redirect-checkout";

const demoRoutesEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_ROUTES === "true" ||
  process.env.ENABLE_DEMO_ROUTES === "true";

export const STOREFRONT_ROUTE_INVENTORY = {
  official: [
    "/",
    "/categories",
    "/shop",
    "/products",
    "/products/[slug]",
    "/product/[slug]",
    "/product/search/[slug]",
    "/search",
    "/cart",
    "/checkout",
    "/payment",
    "/payment/error",
    "/payment/success",
    "/review",
    "/auth/complete",
    "/account/login",
    "/account/register",
    "/account/forgot-password",
    "/account/orders",
    "/account/profile",
    "/account/address",
    "/account/wish-list",
  ],
  demo: [
    "/login",
    "/signup",
    "/shops",
    "/market-1",
    "/mobile-category-nav",
    "/checkout-alternative",
    "/checkout-demo/*",
    "/vendor/*",
  ],
  preserveOnly: [
    "/(layout-3)",
    "/(storefront)/market-1",
    "/page-sections/vendor-dashboard/*",
    "/page-sections/shop/*",
  ],
} as const;

const routeBehaviors: Record<string, DemoRouteBehavior> = {
  login: "redirect-login",
  signup: "redirect-register",
  "checkout-alternative": "redirect-checkout",
  market1: "redirect-home",
  mobileCategoryNav: "notFound",
  shop: "public",
  shops: "notFound",
  vendor: "notFound",
  checkoutDemo: "notFound",
};

export const isDemoRouteEnabled = () => demoRoutesEnabled;

export const enforcePublicRoute = (routeKey: keyof typeof routeBehaviors) => {
  if (demoRoutesEnabled) return;

  switch (routeBehaviors[routeKey]) {
    case "public":
      return;
    case "redirect-home":
      redirect("/");
    case "redirect-login":
      redirect("/account/login");
    case "redirect-register":
      redirect("/account/register");
    case "redirect-checkout":
      redirect("/checkout");
    case "notFound":
    default:
      notFound();
  }
};
