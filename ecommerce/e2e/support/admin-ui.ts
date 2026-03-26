import { expect, type Page } from "@playwright/test";

const adminAppBaseUrl = process.env.PLAYWRIGHT_ADMIN_APP_URL ?? "http://localhost:8080";
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "desarrollo@software-strategy.com";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "LocalAdmin123!";

export async function loginAsAdminUser(
  page: Page,
  credentials?: { email?: string; password?: string },
) {
  await page.goto(`${adminAppBaseUrl}/sign-in`);
  await page
    .locator('input[name="email"]')
    .fill(credentials?.email ?? adminEmail);
  await page
    .locator('input[name="password"]')
    .fill(credentials?.password ?? adminPassword);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/app\//, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/app\//);
}

export async function loginAsAdmin(page: Page) {
  await loginAsAdminUser(page, {
    email: adminEmail,
    password: adminPassword,
  });
}

export function resolveAdminAppUrl(path: string) {
  return `${adminAppBaseUrl}${path}`;
}
