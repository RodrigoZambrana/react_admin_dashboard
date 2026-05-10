import { expect, test, type Page } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { registerCustomer } from "./support/storefront-api";
import { loginAsAdminUser } from "./support/admin-ui";

async function loginCustomer(page: Page, customer: { email: string; password: string }) {
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("auth-login-form")).toBeHidden({ timeout: 20_000 });
}

test("storefront session survives cross-app navigation to admin and back", async ({ page, request }) => {
  const customer = buildTestCustomer(Date.now() + 33_000);
  await registerCustomer(request, customer);

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await loginCustomer(page, customer);

  const sessionBefore = await page.evaluate(async () => {
    const response = await fetch("http://localhost:8080/api/storefront/auth/session", {
      credentials: "include",
    });
    return response.ok ? response.text() : null;
  });
  expect(sessionBefore).toContain("customer");

  await loginAsAdminUser(page);
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

  const sessionAfter = await page.evaluate(async () => {
    const response = await fetch("http://localhost:8080/api/storefront/auth/session", {
      credentials: "include",
    });
    return response.ok ? response.text() : null;
  });
  expect(sessionAfter).toContain("customer");
  expect(sessionAfter).toBe(sessionBefore);
});
