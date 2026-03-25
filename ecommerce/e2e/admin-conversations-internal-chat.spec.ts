import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin can create an internal AI conversation from the inbox", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const subject = `Chat interno ${uniqueId}`;
  const message = "Necesito ayuda interna con el catálogo";

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await page
    .getByTestId("admin-conversations-internal-subject")
    .fill(subject);
  await page
    .getByTestId("admin-conversations-internal-message")
    .fill(message);
  await page.getByTestId("admin-conversations-internal-create").click();

  await expect(page).toHaveURL(/\/app\/crm\/conversations\/.+$/);
  await expect(page.getByTestId("admin-conversation-detail-title")).toContainText(
    subject,
  );
  await expect(page.getByTestId("admin-conversation-control-mode")).toContainText(
    "Ai",
  );
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').filter({
      hasText: message,
    }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').filter({
      hasText: "Recibí tu consulta",
    }).first(),
  ).toBeVisible({ timeout: 20_000 });
});
