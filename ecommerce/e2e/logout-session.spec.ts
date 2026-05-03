import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { registerCustomer } from "./support/storefront-api";

async function loginThroughHeader(page: Page, customer: ReturnType<typeof buildTestCustomer>) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("auth-login-form")).toBeHidden({ timeout: 20_000 });
}

test("logout invalidates storefront session and clears transient storage", async ({
  page,
  request,
}) => {
  const customer = buildTestCustomer(Date.now());
  await registerCustomer(request, customer);

  await loginThroughHeader(page, customer);

  await page.getByTestId("header-account-button").click();
  await expect(page.getByText(/My Account|Mi cuenta/i)).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: /Log out|Cerrar sesión/i }).click({ force: true });
  await expect(page).toHaveURL(/\/$/);

  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem("storefront.session.v1")),
    )
    .toBeNull();
  await expect
    .poll(async () =>
      page.evaluate(() => window.sessionStorage.getItem("storefront.google.oauth.state")),
    )
    .toBeNull();

  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
});
