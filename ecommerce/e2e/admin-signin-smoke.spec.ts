import { expect, test } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import {
  createOrder,
  fetchFirstInStockCatalogProduct,
  listShippingOptions
} from "./support/storefront-api";

test("admin sign-in works with seeded credentials", async ({ page }) => {
  page.on("requestfailed", (request) => {
    console.log("requestfailed", request.url(), request.failure()?.errorText);
  });
  page.on("response", async (response) => {
    if (response.url().includes("/api/sign-in")) {
      console.log("signin-response", response.url(), response.status(), await response.text());
    }
  });

  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin\//);
});

test("admin order details page does not crash", async ({ page, request }) => {
  const customer = buildTestCustomer(Date.now() + 9001);
  const product = await fetchFirstInStockCatalogProduct(request);
  const shippingOptions = await listShippingOptions(request);

  expect(shippingOptions.length).toBeGreaterThan(0);

  const order = await createOrder(request, {
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      locale: "es"
    },
    shippingAddress: {
      line1: "Norberto Ortiz 4086",
      line2: "Porton verde, Santa Ana",
      street: "Norberto Ortiz",
      number: "4086",
      corner: "Santa Ana",
      apartment: "Porton verde",
      city: "Montevideo",
      department: "Montevideo",
      neighborhood: "Aguada",
      state: "Montevideo",
      zip: "11000",
      country: "Uruguay"
    },
    items: [
      {
        productId: product.id,
        quantity: 1
      }
    ],
    notes: "Smoke admin order detail QA",
    shippingOptionId: shippingOptions[0]!.id,
    fulfillmentMode: "home_delivery",
    currency: "UYU"
  });

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await loginAsAdmin(page);
  await page.goto(
    resolveAdminAppUrl(`/admin/sales/order-details/${order.uuid}`),
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.getByTestId("admin-order-customer-info")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("admin-order-shipping-address")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(order.uuid).first()).toBeVisible({ timeout: 20_000 });

  expect(pageErrors).toEqual([]);
});
