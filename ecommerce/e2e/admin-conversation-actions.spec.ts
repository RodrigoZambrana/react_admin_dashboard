import { expect, test } from "@playwright/test";

import { loginAsAdmin, resolveAdminAppUrl } from "./support/admin-ui";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:4000";

test("admin can takeover, reply and release a conversation", async ({
  page,
  request,
}) => {
  const seedResponse = await request.post(
    `${backendBaseUrl}/api/conversations/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: `guest-actions-${Date.now()}`,
        name: "Takeover Flow",
        email: `takeover-${Date.now()}@example.com`,
        locale: "es-UY",
        page: "/shop",
      },
    },
  );

  expect(seedResponse.ok()).toBeTruthy();
  const seeded = await seedResponse.json();

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

  await page.getByTestId("admin-conversation-details-open").click();
  await page.getByTestId("admin-conversation-handoff-notes").fill("Tomo manualmente el caso");
  await page.getByTestId("admin-conversation-takeover").click();
  await expect(page.getByTestId("admin-conversation-assignee")).toContainText("Local Admin");

  await page.keyboard.press("Escape");

  await page.getByTestId("admin-conversation-reply-input").fill("Te respondo desde el operador");
  await page.getByTestId("admin-conversation-reply-submit").click();
  await expect(
    page.locator('[data-testid^="admin-conversation-message-"]').last(),
  ).toContainText("Te respondo desde el operador");

  await page.getByTestId("admin-conversation-details-open").click();
  await page.getByTestId("admin-conversation-release").click();
  await expect(page.getByTestId("admin-conversation-assignee")).toContainText(
    "Sin asignar",
  );
});
