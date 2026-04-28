import { expect, test } from "@playwright/test";

import { createManagedAdminUser } from "./support/admin-api";
import { loginAsAdminUser, resolveAdminAppUrl } from "./support/admin-ui";

test("support role only sees permitted admin navigation modules", async ({ page, request }) => {
  const uniqueId = Date.now();
  const email = `support.rbac.${uniqueId}@example.com`;
  const password = `SupportRbac@${uniqueId}`;

  await createManagedAdminUser(request, {
    name: "Support",
    lastName: "RBAC",
    email,
    password,
    role: "ADMIN",
    capabilityGroups: ["support"],
  });

  await loginAsAdminUser(page, { email, password });
  await page.goto(resolveAdminAppUrl("/app/products/list"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByText(/Access Denied!/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/You have no permission to visit this page/i).first()).toBeVisible({
    timeout: 20_000,
  });

  await page.goto(resolveAdminAppUrl("/app/settings/ai/runtime"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("ai-runtime-settings-page")).toHaveCount(0);
});
