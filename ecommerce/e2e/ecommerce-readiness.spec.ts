import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { storefrontApiBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";
import { fetchProductDetail, registerCustomer } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";
const PARAMETRIC_PRODUCT_SLUG = "ventana-corrediza-20-blanco-3mm-1200x2000";

async function getFirstRootCategory(request: APIRequestContext) {
  const response = await request.get(`${storefrontApiBaseUrl}/categories`);
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  const stack = Array.isArray(payload) ? [...payload] : Array.isArray(payload?.data) ? [...payload.data] : [];

  while (stack.length > 0) {
    const category = stack.shift() as { slug?: string; name?: string; children?: unknown[] } | undefined;
    if (!category) continue;
    if (typeof category.slug === "string" && category.slug.length > 0) {
      return {
        slug: category.slug,
        name: category.name ?? category.slug,
      };
    }
    if (Array.isArray(category.children)) {
      stack.push(...category.children);
    }
  }

  throw new Error("No storefront category with slug was found.");
}

async function loginThroughHeaderModal(page: Page, identifier: string, password: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("auth-login-identifier").fill(identifier);
  await page.getByTestId("auth-login-password").fill(password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("auth-login-form")).toBeHidden({ timeout: 20_000 });
  await page.getByTestId("header-account-button").click();
  await expect(page.getByText(/My Account|Mi cuenta/i)).toBeVisible({ timeout: 20_000 });
}

async function registerThroughUi(page: Page, customer: ReturnType<typeof buildTestCustomer>) {
  await page.goto("/account/register", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByTestId("auth-register-first-name").fill(customer.firstName);
  await page.getByTestId("auth-register-last-name").fill(customer.lastName);
  await page.getByTestId("auth-register-email").fill("");
  await page.getByTestId("auth-register-phone").fill(customer.phone);
  await page.getByTestId("auth-register-password").fill(customer.password);
  await page.getByTestId("auth-register-confirm-password").fill(customer.password);
  await page.getByTestId("auth-register-agreement").check();
  await expect(page.getByTestId("auth-register-agreement")).toBeChecked({ timeout: 20_000 });
  await page.getByTestId("auth-register-submit").click();
  await expect(page).toHaveURL(/\/account\/profile$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /My Profile|Mi perfil/i })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("ecommerce readiness", () => {
  test.setTimeout(90_000);

  test.skip("renders public SEO metadata and category/catalog entry points", async ({ page, request }) => {
    const category = await getFirstRootCategory(request);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/urucortinas/i);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Cortinas a medida con producción nacional/i,
    );

    await page.goto("/categories", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Categorías · urucortinas/i);
    await expect(page.getByText(/categories\.page\.loaded|loaded \d+ categories/i)).toBeVisible();

    await page.goto("/tienda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Tienda · urucortinas|Tienda/i);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /experiencia comercial actual/i,
    );

    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Catálogo · urucortinas|Catálogo/i);
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/shop?category=${encodeURIComponent(category.slug)}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(new RegExp(`Browsing .*${category.name}`, "i")).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test.skip("opens simple and parametric product details with purchase controls", async ({ page, request }) => {
    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const parametric = await fetchProductDetail(request, PARAMETRIC_PRODUCT_SLUG);

    await page.goto(`/product/${simple.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(new RegExp(`${simple.name}.*urucortinas`, "i"));
    await expect(page.getByText(simple.name, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible();

    await page.goto(`/product/${parametric.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(new RegExp(`${parametric.name}.*urucortinas`, "i"));
    await expect(page.getByText(parametric.name, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible({
      timeout: 20_000,
    });
  });

  test.skip("logs in with email and phone through the storefront UI", async ({ page, request }) => {
    const customer = buildTestCustomer(Date.now());
    await registerCustomer(request, customer);

    await loginThroughHeaderModal(page, customer.email, customer.password);
    await expect(page.getByText(customer.firstName)).toBeVisible({ timeout: 20_000 });
  });

  test.skip("registers a customer with phone only and reaches the authenticated profile", async ({ page }) => {
    const customer = buildTestCustomer(Date.now() + 1);
    await registerThroughUi(page, customer);
    await expect(
      page.getByRole("heading", { name: new RegExp(`${customer.firstName}\\s+${customer.lastName}`, "i") }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
