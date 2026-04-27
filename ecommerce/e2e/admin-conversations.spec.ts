import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { aiPlatformApiBaseUrl } from "./support/env";

test("admin can open the conversations hub and inspect a webchat session", async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const seedResponse = await request.post(
    `${aiPlatformApiBaseUrl}/chat/public/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: `guest-${Date.now()}`,
        name: "Test Conversation",
        email: `conversations-${Date.now()}@example.com`,
        locale: "es-UY",
        page: "/shop",
      },
    }
  );

  expect(seedResponse.ok()).toBeTruthy();
  const seeded = await seedResponse.json();
  expect(seeded.conversationId).toBeTruthy();

  await loginAsAdmin(page);

  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("admin-conversations-page")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("admin-conversations-sidebar")).toBeVisible();
  await expect(page.getByTestId("admin-conversations-list")).toBeVisible();

  const conversationRow = page.getByTestId(
    `admin-conversation-${seeded.conversationId}`
  );
  await expect(conversationRow).toBeVisible({ timeout: 20_000 });
  await conversationRow.click();

  await expect(page).toHaveURL(
    new RegExp(`/app/crm/conversations/${seeded.conversationId}$`)
  );
  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible();
  await expect(page.getByTestId("admin-conversation-detail-title")).toContainText(
    "Test Conversation"
  );
  await page.getByTestId("admin-conversations-rail-directory").click();
  await expect(page.getByTestId("admin-conversations-inboxes")).toBeVisible();
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').first()
  ).toBeVisible({ timeout: 20_000 });

  expect(pageErrors).toEqual([]);
});
