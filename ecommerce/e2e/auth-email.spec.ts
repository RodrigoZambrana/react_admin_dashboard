import { expect, test } from "@playwright/test";

import { waitForEmailActionLink } from "./support/db";
import { storefrontApiBaseUrl } from "./support/env";
import { buildTestCustomer } from "./support/factories";
import { registerCustomer } from "./support/storefront-api";

test.describe("storefront auth email flows", () => {
  test("registers with email and completes email verification", async ({ page }) => {
    const customer = buildTestCustomer();

    await page.addInitScript(() => {
      window.localStorage.setItem("storefront.locale.v1", "es");
    });

    await page.goto("/account/register");

    await page.getByTestId("auth-register-first-name").fill(customer.firstName);
    await page.getByTestId("auth-register-last-name").fill(customer.lastName);
    await page.getByTestId("auth-register-email").fill(customer.email);
    await page.getByTestId("auth-register-phone").fill(customer.phone);
    await page.getByTestId("auth-register-password").fill(customer.password);
    await page.getByTestId("auth-register-confirm-password").fill(customer.password);
    await page.getByTestId("auth-register-agreement").check();
    await page.getByTestId("auth-register-submit").click();

    await page.waitForURL("**/");

    await page.goto("/account/profile");
    await expect(page.getByTestId("account-email-verification-status")).toContainText(/pendiente|pending/i);

    const verification = await waitForEmailActionLink(customer.email, "verify_email");
    await page.goto(verification.url);

    await expect(page.getByText(/fue verificado correctamente|verified successfully/i)).toBeVisible();

    await page.goto("/account/profile");
    await expect(page.getByTestId("account-email-verification-status")).toContainText(/verificado|verified/i);
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

    await page.goto("/account/forgot-password");
    await page.getByTestId("auth-forgot-password-email").fill(customer.email);
    await page.getByTestId("auth-forgot-password-submit").click();

    await expect(page.getByTestId("auth-forgot-password-submit")).toContainText(/correo enviado|sent/i);

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
