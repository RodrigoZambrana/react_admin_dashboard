import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin can create an internal AI conversation from the inbox", async ({
  page,
}) => {
  const message = "Necesito ayuda interna con el catálogo";

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await page.getByTestId("admin-conversations-new-chat").click();
  await expect(page.getByTestId("admin-conversations-contact-list")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("admin-conversations-contact-internal-assistant")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId("admin-conversations-contact-internal-assistant").click();
  await page.getByTestId("admin-conversations-message-body").fill(message);
  await page.getByTestId("admin-conversations-start-message").click();

  await expect(page).toHaveURL(/\/app\/crm\/conversations\/.+$/);
  await expect(page.getByTestId("admin-conversation-detail-title")).toBeVisible({
    timeout: 20_000,
  });
});
