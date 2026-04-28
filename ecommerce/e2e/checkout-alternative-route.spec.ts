import { expect, test } from "@playwright/test";

import { storefrontBaseUrl } from "./support/env";

test("checkout alternative route redirects to the official checkout when demo routes are disabled", async ({
  page,
}) => {
  await page.goto(`${storefrontBaseUrl}/checkout-alternative`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveURL(/\/checkout$/);
});
