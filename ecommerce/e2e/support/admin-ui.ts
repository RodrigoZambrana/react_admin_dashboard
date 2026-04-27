import { expect, type Page } from "@playwright/test";

const adminAppBaseUrl = process.env.PLAYWRIGHT_ADMIN_APP_URL ?? "http://localhost:8080";
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "desarrollo@software-strategy.com";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Pass123";

export async function loginAsAdminUser(
  page: Page,
  credentials?: { email?: string; password?: string },
) {
  const targetUrl = `${adminAppBaseUrl}/sign-in`;
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    try {
      await emailInput.waitFor({ state: "visible", timeout: 8_000 });
    } catch (error) {
      if (/\/app\//.test(page.url())) {
        await expect(page).toHaveURL(/\/app\//);
        return;
      }

      if (attempt === 2) {
        throw error;
      }

      await page.reload({ waitUntil: "domcontentloaded" });
      continue;
    }

    await emailInput.fill(credentials?.email ?? adminEmail);
    await passwordInput.fill(credentials?.password ?? adminPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/app\//, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/app\//);
    return;
  }
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
