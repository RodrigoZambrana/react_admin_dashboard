import { expect, type Page } from "@playwright/test";

const adminAppBaseUrl = process.env.PLAYWRIGHT_ADMIN_APP_URL ?? "http://localhost:8080";
const adminApiBaseUrl = process.env.PLAYWRIGHT_ADMIN_API_URL ?? "http://localhost:8080/api";
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "desarrollo@software-strategy.com";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Pass123";

export async function loginAsAdminUser(
  page: Page,
  credentials?: { email?: string; password?: string },
) {
  const response = await fetch(`${adminApiBaseUrl}/sign-in`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: credentials?.email ?? adminEmail,
      password: credentials?.password ?? adminPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(`Admin sign-in failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    token?: string;
    accessToken?: string;
    data?: { token?: string; accessToken?: string };
  };
  const token =
    payload.token ??
    payload.accessToken ??
    payload.data?.token ??
    payload.data?.accessToken;

  if (!token) {
    throw new Error("Admin sign-in did not return a token");
  }

  await page.context().addCookies([
    {
      name: "access_token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto(`${adminAppBaseUrl}/app/sales/dashboard`, {
    waitUntil: "domcontentloaded",
  });
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
