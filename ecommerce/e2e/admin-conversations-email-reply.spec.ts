import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

const channelAdapterBaseUrl =
  process.env.PLAYWRIGHT_CHANNEL_ADAPTER_URL ?? "http://127.0.0.1:4200";

test("admin can reply to an email conversation and persist outbound delivery status", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const subject = `Reply email ${uniqueId}`;
  const replyText = `Respuesta operator ${uniqueId}`;

  const emailResponse = await request.post(
    `${channelAdapterBaseUrl}/webhooks/email`,
    {
      data: {
        tenantKey: "urucortinas",
        fromAddress: `cliente-reply-${uniqueId}@example.com`,
        fromName: "Cliente Reply",
        toAddress: "ventas@urucortinas.com",
        inboxAddress: "ventas@urucortinas.com",
        subject,
        threadId: `thread-reply-${uniqueId}`,
        providerMessageId: `email-reply-${uniqueId}`,
        queueSlug: "support",
        body: "Necesito una respuesta por email",
        metadata: {
          provider: "test",
        },
      },
    },
  );

  expect(emailResponse.ok()).toBeTruthy();

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await page.getByTestId("admin-conversations-channel-email").click();

  const row = page.getByText(subject).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  await page.getByTestId("admin-conversation-reply-input").fill(replyText);
  await page.getByTestId("admin-conversation-reply-submit").click();

  const lastMessage = page
    .locator('[data-testid^="admin-conversation-message-"]')
    .last();
  await expect(lastMessage).toContainText(replyText, { timeout: 20_000 });
  await expect(lastMessage).toContainText("Sent");
});
