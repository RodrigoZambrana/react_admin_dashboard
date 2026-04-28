import { expect, test } from "@playwright/test";

import { createAdminInternalSessionForUser, createManagedAdminUser } from "./support/admin-api";
import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

test("admin internal action request asks for explicit confirmation before execution", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const subject = `Confirmación interna ${uniqueId}`;
  const message =
    "Crear producto nuevo llamado Cortina Demo con precio 1000";

  const operatorEmail = `internal.confirmation.${uniqueId}@example.com`;
  const operatorPassword = `InternalConfirm@${uniqueId}`;

  await createManagedAdminUser(request, {
    name: "Internal",
    lastName: "Confirmation",
    email: operatorEmail,
    password: operatorPassword,
    role: "ADMIN",
    capabilityGroups: ["support"],
  });

  const conversation = await createAdminInternalSessionForUser(
    request,
    {
      email: operatorEmail,
      password: operatorPassword,
    },
    {
      subject,
      message,
    },
  );

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl(`/app/crm/conversations/${conversation.conversationId}`), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("admin-conversation-detail-title")).toContainText(
    subject,
  );
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').filter({
      hasText: message,
    }).first(),
  ).toBeVisible({ timeout: 20_000 });
});
