import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";
const internalToken =
  process.env.PLAYWRIGHT_AI_INTERNAL_TOKEN ?? "local-ai-internal-token";

test("supervisor can reroute a conversation to another queue from the inbox detail", async ({
  page,
  request,
}) => {
  const timestamp = Date.now();

  const seedSupport = await request.post(
    `${backendBaseUrl}/api/conversations/internal/inbound`,
    {
      headers: {
        "x-ai-internal-token": internalToken,
      },
      data: {
        tenantKey: "urucortinas",
        channel: "email",
        userId: `routing-${timestamp}@example.com`,
        inboxAddress: "ventas@urucortinas.com",
        subject: "Consulta para enrutar",
        threadId: `routing-thread-${timestamp}`,
        externalMessageId: `routing-msg-${timestamp}`,
        text: "Necesito ayuda con un caso de soporte",
        queueSlug: "support",
        metadata: { provider: "imap" },
      },
    },
  );

  const seedSocial = await request.post(
    `${backendBaseUrl}/api/conversations/internal/inbound`,
    {
      headers: {
        "x-ai-internal-token": internalToken,
      },
      data: {
        tenantKey: "urucortinas",
        channel: "whatsapp",
        userId: `5989${timestamp}`.slice(0, 11),
        threadId: `social-thread-${timestamp}`,
        externalMessageId: `social-msg-${timestamp}`,
        text: "Crear cola social",
        queueSlug: "social",
        metadata: { provider: "meta" },
      },
    },
  );

  expect(seedSupport.ok()).toBeTruthy();
  expect(seedSocial.ok()).toBeTruthy();
  const seeded = await seedSupport.json();

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

  await page.getByTestId("admin-conversation-mobile-details").click();
  await page
    .getByTestId("admin-conversation-override-queue")
    .selectOption("social");
  await page.getByTestId("admin-conversation-reroute").click();

  await expect(page.getByTestId("admin-conversation-sla-detail")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("admin-conversation-detail")).toContainText(
    "Social",
  );
});
