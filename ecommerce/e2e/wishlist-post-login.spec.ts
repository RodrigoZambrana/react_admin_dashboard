import { expect, test } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { fetchProductDetail, registerCustomer } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

test("persists a pending wishlist intent through login and adds the product automatically", async ({
  page,
  request
}) => {
  const customer = buildTestCustomer();
  await registerCustomer(request, customer);

  const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);

  await page.goto(`/product/${product.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("product-detail-title")).toHaveText(product.name, { timeout: 20_000 });
  const wishlistButton = page.getByTestId(`wishlist-button-${product.id}`);
  await expect(wishlistButton).toBeVisible({ timeout: 20_000 });
  await wishlistButton.click();

  await expect(page.getByTestId("auth-login-form")).toBeVisible();
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();

  await expect(page.getByTestId("auth-login-form")).toBeHidden();
  await page.waitForLoadState("networkidle");
  await expect
    .poll(() =>
      page.evaluate(() => window.sessionStorage.getItem("storefront.pendingWishlistProductId"))
    )
    .toBeNull();

  await page.goto("/account/wish-list");
  const wishlistItem = page.getByTestId(`wishlist-item-${product.id}`);
  await expect(wishlistItem).toBeVisible({ timeout: 20_000 });
  await expect(wishlistItem.getByRole("heading", { name: product.name })).toBeVisible();
});
