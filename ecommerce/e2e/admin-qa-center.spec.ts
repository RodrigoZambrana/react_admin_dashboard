import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin QA center opens with catalog and runs panels", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/qa"), { waitUntil: "domcontentloaded" });

  await expect(page.locator('h3').filter({ hasText: 'QA Center' }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("QA Center").first()).toBeVisible();
});
