import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin can open AI runtime settings and see usage warnings", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/settings/ai"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("ai-runtime-settings-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("ai-runtime-usage-alert")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-provider")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-model")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-limit")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-threshold")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-save")).toBeVisible();
});
