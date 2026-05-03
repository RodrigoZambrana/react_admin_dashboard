import { expect, test, type Page } from "@playwright/test";

import { waitForEmailActionLink } from "./support/db";
import { storefrontApiBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";
import { registerCustomer } from "./support/storefront-api";

async function loginCustomer(page: Page, customer: { email: string; password: string }) {
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("auth-login-form")).toBeHidden({ timeout: 20_000 });
}

test.describe("storefront auth email flows", () => {
  test("registers with email and completes email verification", async ({ page, request }) => {
    const customer = buildTestCustomer();

    await page.addInitScript(() => {
      window.localStorage.setItem("storefront.locale.v1", "es");
    });

    await registerCustomer(request, customer);

    await loginCustomer(page, customer);
    await page.goto("http://localhost:3000/account/profile", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/pendiente de verificación|pending/i);

    const verification = await waitForEmailActionLink(customer.email, "verify_email");
    await page.goto(verification.url);

    await expect(page.getByText(/fue verificado correctamente|verified successfully/i)).toBeVisible();

    await page.goto("http://localhost:3000/account/profile", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/verificado|verified/i);
  });

  test("sends a reset link by email and allows choosing a new password", async ({
    page,
    request
  }) => {
    const customer = buildTestCustomer();
    const nextPassword = `${customer.password}X!`;

    await page.addInitScript(() => {
      window.localStorage.setItem("storefront.locale.v1", "es");
    });

    await registerCustomer(request, customer);

    const recoveryResponse = await request.post(`${storefrontApiBaseUrl}/auth/password/forgot`, {
      data: {
        channel: "email",
        email: customer.email
      }
    });
    expect(recoveryResponse.ok()).toBeTruthy();

    const reset = await waitForEmailActionLink(customer.email, "reset_link");

    await page.goto(reset.url);
    await page.getByTestId("auth-reset-password").fill(nextPassword);
    await page.getByTestId("auth-reset-password-confirm").fill(nextPassword);
    await page.getByTestId("auth-reset-password-submit").click();

    await expect(page.getByTestId("auth-reset-password-submit")).toContainText(
      /contraseña actualizada|password updated/i
    );

    const loginResponse = await request.post(`${storefrontApiBaseUrl}/auth/login`, {
      data: {
        identifier: customer.email,
        password: nextPassword
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
  });
});
