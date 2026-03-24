import { expect, test } from "@playwright/test";

test("admin sign-in works with seeded credentials", async ({ page }) => {
  page.on("requestfailed", (request) => {
    console.log("requestfailed", request.url(), request.failure()?.errorText);
  });
  page.on("response", async (response) => {
    if (response.url().includes("/api/sign-in")) {
      console.log("signin-response", response.url(), response.status(), await response.text());
    }
  });

  await page.goto("http://localhost:8080/sign-in");

  await page.locator('input[name="email"]').fill("desarrollo@software-strategy.com");
  await page.locator('input[name="password"]').fill("LocalAdmin123!");
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/app\//, { timeout: 15000 });
  await expect(page).toHaveURL(/\/app\//);
});

test("admin order details page does not crash", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("http://localhost:8080/sign-in");
  await page.locator('input[name="email"]').fill("desarrollo@software-strategy.com");
  await page.locator('input[name="password"]').fill("LocalAdmin123!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/app\//, { timeout: 15000 });

  await page.goto("http://localhost:8080/app/sales/order-details/dfef9302-909b-5fa3-ac95-f6196e651592");
  await page.waitForLoadState("networkidle");

  expect(pageErrors).toEqual([]);
});
