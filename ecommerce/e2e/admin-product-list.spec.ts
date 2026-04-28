import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin product list opens and shows catalog rows", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/products/list"), { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Product List|Listado de productos/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Product Variable QA API 2|Producto Variable QA API 2/i).first()).toBeVisible({
    timeout: 20_000,
  });
});
