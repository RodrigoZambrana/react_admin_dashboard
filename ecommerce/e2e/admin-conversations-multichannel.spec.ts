import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

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
        toAddress: "ventas@urucortinas.com",
        inboxAddress: "ventas@urucortinas.com",
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

  await page.getByTestId("admin-conversations-channel-email").click();
  await expect(page.getByTestId("admin-conversations-queue-filter")).toBeVisible();

  const row = page.getByText(`Consulta email ${uniqueId}`).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
});
