import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import {
  getAiPlatformChannelMessageRecordByRemoteId,
  getAiPlatformMessageById,
} from "./support/db";
import {
  aiPlatformApiBaseUrl,
  aiPlatformInternalToken,
  channelAdapterMetaAppSecret,
} from "./support/env";

const channelAdapterBaseUrl =
  process.env.PLAYWRIGHT_CHANNEL_ADAPTER_URL ?? "http://127.0.0.1:4200";

function signMetaPayload(payload: unknown) {
  const raw = JSON.stringify(payload);
  const digest = createHmac("sha256", channelAdapterMetaAppSecret)
    .update(raw)
    .digest("hex");
  return `sha256=${digest}`;
}

test("admin inbox syncs Meta outbound delivery status back into the conversation", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const threadId = `fb-thread-${uniqueId}`;
  const inboundText = `Necesito seguimiento por Messenger ${uniqueId}`;
  const replyText = `Respuesta Messenger ${uniqueId}`;

  const bootstrapResponse = await request.post(
    `${aiPlatformApiBaseUrl}/internal/conversations/bootstrap-thread`,
    {
      headers: {
        "x-ai-internal-token": aiPlatformInternalToken,
      },
      data: {
        tenantKey: "urucortinas",
        channel: "facebook",
        userId: `5989000${uniqueId}`,
        threadId,
        displayName: "Cliente Messenger",
        email: `fb-${uniqueId}@example.com`,
        inboxAddress: "facebook-page",
        metadata: {
          provider: "playwright-meta",
        },
      },
    },
  );

  expect(bootstrapResponse.ok()).toBeTruthy();
  const bootstrapPayload = (await bootstrapResponse.json()) as {
    id?: string;
    conversationId?: string;
  };
  const conversationId = bootstrapPayload.conversationId ?? bootstrapPayload.id;
  if (!conversationId) {
    throw new Error("bootstrap-thread did not return a conversation id");
  }

  const inboundResponse = await request.post(
    `${aiPlatformApiBaseUrl}/internal/conversations/inbound`,
    {
      headers: {
        "x-ai-internal-token": aiPlatformInternalToken,
      },
      data: {
        tenantKey: "urucortinas",
        channel: "facebook",
        userId: `5989000${uniqueId}`,
        conversationId,
        threadId,
        displayName: "Cliente Messenger",
        email: `fb-${uniqueId}@example.com`,
        subject: inboundText,
        text: inboundText,
        externalMessageId: `fb-in-${uniqueId}`,
        authorKind: "customer_human",
        messageKind: "text",
        direction: "inbound",
        metadata: {
          provider: "playwright-meta",
          subject: inboundText,
          fromName: "Cliente Messenger",
        },
      },
    },
  );

  expect(inboundResponse.ok()).toBeTruthy();

  await loginAsAdmin(page);
  await page.goto(resolveAdminAppUrl(`/app/crm/conversations/${conversationId}`), {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId("admin-conversation-detail")).toBeVisible({
    timeout: 20_000,
  });

  await expect(page.getByText(inboundText).first()).toBeVisible({
    timeout: 20_000,
  });

  const manualReplyResponse = await request.post(
    `${aiPlatformApiBaseUrl}/internal/conversations/${conversationId}/replies/agent`,
    {
      headers: {
        "x-ai-internal-token": aiPlatformInternalToken,
      },
      data: {
        body: replyText,
        finalUserText: replyText,
        metadata: {
          source: "playwright-meta-status",
        },
      },
    },
  );

  expect(manualReplyResponse.ok()).toBeTruthy();
  const manualReplyPayload = (await manualReplyResponse.json()) as {
    id: string;
    conversationId: string;
    content: string;
  };

  const replyMessage = page.locator(
    '[data-testid^="admin-conversation-message-"]',
  ).filter({
    hasText: replyText,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(replyMessage).toBeVisible({ timeout: 20_000 });

  const statusResponse = await request.post(
    `${channelAdapterBaseUrl}/webhooks/meta`,
    {
      headers: {
        "x-hub-signature-256": signMetaPayload({
          statuses: [
            {
              conversationId,
              inboxAccountId: null,
              channel: "facebook",
              messageId: manualReplyPayload.id,
              providerMessageId: manualReplyPayload.id,
              status: "delivered",
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              metadata: {
                source: "playwright-meta-status",
              },
            },
          ],
        }),
      },
      data: {
        statuses: [
          {
            conversationId,
            inboxAccountId: null,
            channel: "facebook",
            messageId: manualReplyPayload.id,
            providerMessageId: manualReplyPayload.id,
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
  const persistedMessage = await getAiPlatformMessageById(manualReplyPayload.id);
  expect(persistedMessage?.content).toBe(replyText);
  expect(persistedMessage?.metadata?.deliveryStatus).toBe("delivered");

  const channelRecord = await getAiPlatformChannelMessageRecordByRemoteId(
    manualReplyPayload.id,
  );
  expect(channelRecord?.status).toBe("delivered");
  expect(channelRecord?.metadata?.rawStatus).toBe("delivered");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(replyMessage).toContainText(replyText, { timeout: 20_000 });
});
