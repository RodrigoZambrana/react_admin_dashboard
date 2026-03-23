import { expect, test } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { fetchFirstCatalogProduct, registerCustomer } from "./support/storefront-api";

test("persists a pending wishlist intent through login and adds the product automatically", async ({
  page,
  request
}) => {
  const customer = buildTestCustomer();
  await registerCustomer(request, customer);

  const product = await fetchFirstCatalogProduct(request);

  await page.goto(`/product/${product.slug}`);
  await page.getByTestId(`wishlist-button-${product.id}`).click();

  await expect(page.getByTestId("auth-login-form")).toBeVisible();
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();

  await expect(page.getByTestId("auth-login-form")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => window.sessionStorage.getItem("storefront.pendingWishlistProductId"))
    )
    .toBeNull();

  await page.goto("/account/wish-list");
  const wishlistItem = page.getByTestId(`wishlist-item-${product.id}`);
  await expect(wishlistItem).toBeVisible();
  await expect(wishlistItem.getByRole("heading", { name: product.name })).toBeVisible();
});
