import { expect, test, type Page } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { fetchProductDetail } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

async function bootstrapStorefrontContext(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("storefront.cart.v1");
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "UYU");
  });
}

async function seedSimpleCart(page: Page, request: Parameters<typeof fetchProductDetail>[0]) {
  const product = (await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG)) as any;

  await page.addInitScript(
    ({ storageKey, nextCartState }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(nextCartState));
    },
    {
      storageKey: "storefront.cart.v1",
      nextCartState: {
        updatedAt: Date.now(),
        items: [
          {
            quantity: 1,
            product: {
              id: String(product.id),
              productId: product.id,
              mode: product.mode,
              slug: product.slug,
              name: product.name,
              thumbnail: product.thumbnail ?? null,
              price: product.price,
              salePrice: product.salePrice ?? null,
              inventoryStatus: product.inventoryStatus ?? "in-stock",
              configuration: undefined,
            },
          },
        ],
      },
    },
  );
}

async function fillValidCheckoutBase(page: Page, customer = buildTestCustomer()) {
  await page.goto("/checkout");
  await expect(page.getByTestId("checkout-first-name")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("checkout-first-name").fill(customer.firstName);
  await page.getByTestId("checkout-last-name").fill(customer.lastName);
  await page.getByTestId("checkout-email").fill(customer.email);
  await page.getByTestId("checkout-phone").fill(customer.phone);
  await page.getByTestId("checkout-street").fill("Av. Italia");
  await page.getByTestId("checkout-number").fill("1234");
  await page.getByTestId("checkout-corner").fill("Comercio");
  await page.getByTestId("checkout-apartment").fill("101");
  await page.getByLabel(/^Departamento$/i).click();
  await page.getByText(/^Montevideo$/i).last().click();
  await page.getByLabel(/^Ciudad$/i).click();
  await page.getByText(/^Montevideo$/i).last().click();
  await page.getByLabel(/^Barrio$/i).click();
  await page.getByText(/^Aguada$/i).click();
}

async function openLoginForm(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("header-account-button")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
}

test.describe("negative validation surfaces", () => {
  test("rejects login with malformed identifier", async ({ page }) => {
    await bootstrapStorefrontContext(page);
    await openLoginForm(page);

    await page.getByTestId("auth-login-identifier").fill("abc123");
    await page.getByTestId("auth-login-password").fill("Storefront@2024");
    await page.getByTestId("auth-login-submit").click();

    await expect(page.getByText(/valid email or phone number|correo o tel[eé]fono válido/i)).toBeVisible();
  });

  test("rejects login with blank password", async ({ page }) => {
    await bootstrapStorefrontContext(page);
    await openLoginForm(page);

    await page.getByTestId("auth-login-identifier").fill("cliente@example.com");
    await page.getByTestId("auth-login-password").fill("");
    await page.getByTestId("auth-login-submit").click();

    await expect(page.getByText(/Password is required/i)).toBeVisible();
  });

  test("rejects register with invalid phone and malformed email", async ({ page }) => {
    await bootstrapStorefrontContext(page);
    await page.goto("/account/register");

    await page.getByTestId("auth-register-first-name").fill("Ana");
    await page.getByTestId("auth-register-last-name").fill("Perez");
    await page.getByTestId("auth-register-email").fill("ana@@example");
    await page.getByTestId("auth-register-phone").fill("abc123");
    await page.getByTestId("auth-register-password").fill("Storefront@2024");
    await page.getByTestId("auth-register-confirm-password").fill("Storefront@2024");
    await page.getByTestId("auth-register-agreement").check();
    await page.getByTestId("auth-register-submit").click();

    await expect(page.getByText(/Enter a valid email|correo/i).first()).toBeVisible();
    await expect(page.getByText(/valid phone number|tel[eé]fono/i).first()).toBeVisible();
  });

  test("rejects checkout with non-numeric street number", async ({ page, request }) => {
    await bootstrapStorefrontContext(page);
    await seedSimpleCart(page, request);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await fillValidCheckoutBase(page);
    await page.getByTestId("checkout-number").fill("abc");
    await page.getByTestId("checkout-continue-to-payment").click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText(/solo n[uú]meros|numbers/i).first()).toBeVisible();
  });

  test("rejects checkout with blank first name", async ({ page, request }) => {
    await bootstrapStorefrontContext(page);
    await seedSimpleCart(page, request);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await fillValidCheckoutBase(page);
    await page.getByTestId("checkout-first-name").fill("   ");
    await page.getByTestId("checkout-continue-to-payment").click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText(/nombre/i).first()).toBeVisible();
  });

  test("rejects checkout with malformed email", async ({ page, request }) => {
    await bootstrapStorefrontContext(page);
    await seedSimpleCart(page, request);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await fillValidCheckoutBase(page);
    await page.getByTestId("checkout-email").fill("bad@@example");
    await page.getByTestId("checkout-continue-to-payment").click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText(/correo válido|valid email/i).first()).toBeVisible();
  });

  test("rejects checkout with blank phone", async ({ page, request }) => {
    await bootstrapStorefrontContext(page);
    await seedSimpleCart(page, request);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await fillValidCheckoutBase(page);
    await page.getByTestId("checkout-phone").fill("   ");
    await page.getByTestId("checkout-continue-to-payment").click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText(/tel[eé]fono/i).first()).toBeVisible();
  });

  test("rejects checkout when neighborhood is missing for Montevideo", async ({
    page,
    request,
  }) => {
    await bootstrapStorefrontContext(page);
    await seedSimpleCart(page, request);
    await page.goto("/checkout");
    await expect(page.getByTestId("checkout-first-name")).toBeVisible({ timeout: 20_000 });

    const customer = buildTestCustomer(Date.now() + 1);
    await page.getByTestId("checkout-first-name").fill(customer.firstName);
    await page.getByTestId("checkout-last-name").fill(customer.lastName);
    await page.getByTestId("checkout-email").fill(customer.email);
    await page.getByTestId("checkout-phone").fill(customer.phone);
    await page.getByTestId("checkout-street").fill("Av. Italia");
    await page.getByTestId("checkout-number").fill("1234");
    await page.getByTestId("checkout-corner").fill("Comercio");
    await page.getByTestId("checkout-apartment").fill("101");
    await page.getByLabel(/^Departamento$/i).click();
    await page.getByRole("option", { name: /^Montevideo$/i }).first().click();
    await page.getByLabel(/^Ciudad$/i).click();
    await page.getByRole("option", { name: /^Montevideo$/i }).first().click();

    await page.getByTestId("checkout-continue-to-payment").click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText(/barrio|neighborhood/i).first()).toBeVisible();
  });
});
