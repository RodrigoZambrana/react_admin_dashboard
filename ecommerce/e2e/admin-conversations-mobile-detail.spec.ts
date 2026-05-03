import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { aiPlatformApiBaseUrl } from "./support/env";

test("mobile admin conversation detail keeps transcript visible and scrollable", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const uniqueId = Date.now();
  const seedResponse = await request.post(
    `${aiPlatformApiBaseUrl}/chat/public/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: `guest-mobile-${uniqueId}`,
        name: "Inbox Mobile",
        email: `mobile-${uniqueId}@example.com`,
        locale: "es-UY",
        page: "/shop",
      },
    },
  );

  expect(seedResponse.ok()).toBeTruthy();
  const seeded = await seedResponse.json();

  for (let index = 0; index < 20; index += 1) {
    const messageResponse = await request.post(
      `${aiPlatformApiBaseUrl}/chat/public/webchat/messages`,
      {
        data: {
          conversationId: seeded.conversationId,
          guestId: `guest-mobile-${uniqueId}`,
          text: `Mensaje mobile ${index + 1}`,
        },
      },
    );
    expect(messageResponse.ok()).toBeTruthy();
  }

  await loginAsAdmin(page);
  await page.goto(
    resolveAdminAppUrl(`/app/crm/conversations/${seeded.conversationId}`),
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("admin-conversation-detail-title")).toContainText(
    "Inbox Mobile",
  );
  await expect(page.getByTestId("admin-conversation-reply-input")).toBeVisible();

  const messages = page.getByTestId("admin-conversation-messages");
  await expect(messages).toBeVisible();

  const lastMessage = messages.getByText("Mensaje mobile 20").last();
  await lastMessage.scrollIntoViewIfNeeded();
  await expect(lastMessage).toBeVisible();
});
