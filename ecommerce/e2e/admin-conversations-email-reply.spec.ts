import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { inboxEmailAddress } from "./support/env";
import { waitForLatestConversationReplyBySubjectInAiPlatform } from "./support/db";

const channelAdapterBaseUrl =
  process.env.PLAYWRIGHT_CHANNEL_ADAPTER_URL ?? "http://127.0.0.1:4200";

test("admin can reply to an email conversation and persist the manual reply", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const subject = `Reply email ${uniqueId}`;
  const displayName = "Cliente Reply";
  const replyText = `Respuesta operator ${uniqueId}`;

  const emailResponse = await request.post(
    `${channelAdapterBaseUrl}/webhooks/email`,
    {
      data: {
        tenantKey: "urucortinas",
        fromAddress: `cliente-reply-${uniqueId}@example.com`,
        fromName: displayName,
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

  const row = page.getByText(displayName).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  await page.getByTestId("admin-conversation-reply-input").fill(replyText);
  await page.getByTestId("admin-conversation-reply-submit").click();

  const outbound = await waitForLatestConversationReplyBySubjectInAiPlatform(
    displayName,
    "email",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(replyText).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(outbound.conversationId).toBeTruthy();
  expect(outbound.remoteId).toBeTruthy();
});
