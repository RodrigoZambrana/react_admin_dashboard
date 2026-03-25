import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin internal action request asks for explicit confirmation before execution", async ({
  page,
}) => {
  const uniqueId = Date.now();
  const subject = `Confirmación interna ${uniqueId}`;
  const message =
    "Crear producto nuevo llamado Cortina Demo con precio 1000";

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
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').filter({
      hasText: "necesito confirmación explícita",
    }).first(),
  ).toBeVisible({ timeout: 20_000 });
});
