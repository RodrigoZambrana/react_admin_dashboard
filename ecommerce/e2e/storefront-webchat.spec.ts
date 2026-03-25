import { expect, test } from "@playwright/test";

test("storefront webchat creates a session and receives an agent reply", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3000/", {
    waitUntil: "domcontentloaded",
  });

  await page.getByTestId("storefront-webchat-launcher").click();
  await expect(page.getByTestId("storefront-webchat-drawer")).toBeVisible();

  await page.getByTestId("storefront-webchat-input").fill("Quiero precio de cortina roller");
  await page.getByTestId("storefront-webchat-send").click();

  await expect(
    page.locator('[data-testid="storefront-webchat-message-customer"]').last(),
  ).toContainText("Quiero precio de cortina roller");
  await expect(
    page.locator('[data-testid="storefront-webchat-message-agent"]').last(),
  ).toBeVisible({ timeout: 20_000 });
});
