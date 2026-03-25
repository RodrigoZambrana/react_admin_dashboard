import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { waitForLatestConversationOutboundByThread } from "./support/db";

const channelAdapterBaseUrl =
  process.env.PLAYWRIGHT_CHANNEL_ADAPTER_URL ?? "http://127.0.0.1:4200";

test("admin inbox syncs Meta outbound delivery status back into the conversation", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const threadId = `wa-thread-${uniqueId}`;
  const inboundText = `Necesito seguimiento por WhatsApp ${uniqueId}`;
  const replyText = `Respuesta WhatsApp ${uniqueId}`;

  const inboundResponse = await request.post(
    `${channelAdapterBaseUrl}/webhooks/meta`,
    {
      data: {
        tenantKey: "urucortinas",
        channel: "whatsapp",
        from: `5989000${uniqueId}`,
        fromName: "Cliente WhatsApp",
        threadId,
        messageId: `wa-in-${uniqueId}`,
        queueSlug: "social",
        body: inboundText,
        metadata: {
          provider: "playwright-meta",
        },
      },
    },
  );

  expect(inboundResponse.ok()).toBeTruthy();

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl("/app/crm/conversations"), {
    waitUntil: "domcontentloaded",
  });

  await page.getByTestId("admin-conversations-channel-whatsapp").click();
  await page.getByTestId("admin-conversations-refresh").click();

  const row = page.getByText(inboundText).first();
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

  const outbound = await waitForLatestConversationOutboundByThread(
    threadId,
    "whatsapp",
  );

  const statusResponse = await request.post(
    `${channelAdapterBaseUrl}/webhooks/meta`,
    {
      data: {
        statuses: [
          {
            conversationId: outbound.conversationId,
            inboxAccountId: outbound.inboxAccountId,
            channel: "whatsapp",
            messageId: outbound.remoteId,
            providerMessageId: outbound.providerMessageId ?? outbound.remoteId,
            status: "delivered",
            timestamp: `${Math.floor(Date.now() / 1000)}`,
            metadata: {
              source: "playwright-meta-status",
            },
          },
        ],
      },
    },
  );

  expect(statusResponse.ok()).toBeTruthy();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(replyMessage).toContainText(replyText, { timeout: 20_000 });
  await expect(replyMessage).toContainText("Delivered");
});
