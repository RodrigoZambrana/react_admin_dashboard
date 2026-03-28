import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";
import { inboxEmailAddress } from "./support/env";

const channelAdapterBaseUrl =
  process.env.PLAYWRIGHT_CHANNEL_ADAPTER_URL ?? "http://127.0.0.1:4200";

test("admin inbox shows projected email conversations with queue metadata", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const emailResponse = await request.post(
    `${channelAdapterBaseUrl}/webhooks/email`,
    {
      data: {
        tenantKey: "urucortinas",
        fromAddress: `cliente-${uniqueId}@example.com`,
        fromName: "Cliente Email",
        toAddress: inboxEmailAddress,
        inboxAddress: inboxEmailAddress,
        subject: `Consulta email ${uniqueId}`,
        threadId: `thread-${uniqueId}`,
        providerMessageId: `email-${uniqueId}`,
        queueSlug: "support",
        body: "Necesito ayuda por email",
        metadata: {
          provider: "test",
        },
      },
    }
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

  const row = page.getByText(`Consulta email ${uniqueId}`).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
});
