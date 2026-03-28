import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { inboxEmailAddress } from "./support/env";
import { waitForLatestConversationOutboundBySubject } from "./support/db";

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
        toAddress: inboxEmailAddress,
        inboxAddress: inboxEmailAddress,
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

  await page.getByTestId("admin-conversations-rail-directory").click();
  await expect(page.getByTestId("admin-conversations-channels")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId("admin-conversations-channel-email").click();

  const row = page.getByText(subject).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  await page.getByTestId("admin-conversation-reply-input").fill(replyText);
  await page.getByTestId("admin-conversation-reply-submit").click();

  const replyMessage = page
    .locator('[data-testid^="admin-conversation-message-"]')
    .filter({
      hasText: replyText,
    })
    .first();
  await expect(replyMessage).toBeVisible({ timeout: 20_000 });

  const outbound = await waitForLatestConversationOutboundBySubject(
    subject,
    "email",
  );

  if (outbound.remoteId) {
    const statusResponse = await request.post(
      `${channelAdapterBaseUrl}/webhooks/email/status`,
      {
        data: {
          conversationId: outbound.conversationId,
          inboxAccountId: outbound.inboxAccountId,
          messageId: outbound.remoteId,
          providerMessageId: outbound.providerMessageId ?? outbound.remoteId,
          status: "delivered",
          provider: "smtp-test",
          metadata: {
            source: "playwright",
          },
        },
      },
    );

    expect(statusResponse.ok()).toBeTruthy();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(replyMessage).toContainText(replyText, { timeout: 20_000 });
    await expect(replyMessage).toContainText(/Delivered|Entregado/);
    return;
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(replyMessage).toContainText(replyText, { timeout: 20_000 });
  await expect(
    page.getByTestId(/admin-conversation-message-status-/).last(),
  ).toContainText(/Entrega fallida|Failed delivery/i);
});
