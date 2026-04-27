import { expect, test } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import {
  createOrder,
  fetchProductDetail,
  listShippingOptions
} from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

test("admin opens a storefront-created order by uuid and sees customer notes", async ({
  page,
  request
}) => {
  const customer = buildTestCustomer(Date.now() + 9000);
  const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
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
    notes: "Nota cross-project QA",
    shippingOptionId: shippingOptions[0]!.id,
    fulfillmentMode: "home_delivery",
    currency: "UYU"
  });

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("http://localhost:8080/sign-in");
  await page.locator('input[name="email"]').fill("desarrollo@software-strategy.com");
  await page.locator('input[name="password"]').fill("Pass123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/app\//, { timeout: 15_000 });

  await page.goto(`http://localhost:8080/app/sales/order-details/${order.uuid}`);
  await expect(page).toHaveURL(
    new RegExp(`/app/sales/order-details/${order.uuid}$`),
  );
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Cliente").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Montevideo, Montevideo").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Uruguay").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Nota cross-project QA").first()).toBeVisible({ timeout: 20_000 });
  expect(pageErrors).toEqual([]);
});
